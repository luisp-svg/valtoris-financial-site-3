import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  premiumAssessmentHttp,
  type PremiumDeps,
  type SavedAssessment,
} from "./http";
import {
  issueAssessmentSession,
  assessmentCookie,
  assessmentCookieName,
} from "./session";
import { combinedFixture } from "./testFixtures";
import { combinedResults } from "../../modules/reportCard/combined/results";
import {
  COMBINED_VERSION,
  primaryAssessment,
} from "../../modules/reportCard/combined/engine";
import { _resetRateLimitStateForTests } from "../ingest/familyReportCard/abuse";
const secret = "local-test-secret-longer-than-32-characters";
const now = Date.parse("2026-10-20T18:00:00Z");
const env = {
  VALTORIS_PREMIUM_ENABLED: "true",
  VALTORIS_ASSESSMENT_SESSION_SECRET: secret,
};
function response() {
  const state: {
    status: number;
    headers: Record<string, string | string[] | number>;
    body: unknown;
  } = { status: 200, headers: {}, body: null };
  const res = {
    setHeader: (k: string, v: string) => {
      state.headers[k] = v;
    },
    status: (code: number) => {
      state.status = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
  };
  return { state, res: res as unknown as VercelResponse };
}
function setup() {
  const issued = issueAssessmentSession(secret, now),
    answers = combinedFixture();
  const saved: SavedAssessment = {
    id: "assessment-test",
    updatedAt: "2026-10-20T18:00:00Z",
    submittedAt: "2026-10-20T18:00:00Z",
    answers,
    derived: {
      combinedReportResults: combinedResults(answers),
      combinedReportResultsByLocale: {
        en: combinedResults(answers),
        es: combinedResults({ ...answers, locale: "es" }),
      },
    },
  };
  const load = vi.fn().mockResolvedValue(saved),
    ingest = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        created: true,
        submissionId: issued.session.id,
        assessmentId: saved.id,
        matchStatus: "new_prospect",
        sheetsSync: { status: "skipped" },
      });
  const verifyBooking = vi.fn().mockResolvedValue(null),
    saveProof = vi.fn().mockResolvedValue(true);
  const deps: PremiumDeps = {
    env,
    now: () => now,
    load,
    ingest,
    verifyBooking,
    saveProof,
  };
  const request = (action: string, body?: unknown) =>
    ({
      method: action === "report" ? "GET" : "POST",
      query: { flow: "premium", action, assessment: issued.session.id },
      headers: {
        host: "localhost:5173",
        origin: "http://localhost:5173",
        cookie: assessmentCookie(issued.token, issued.session.id).split(";")[0],
        "content-type": "application/json",
      },
      body,
      socket: { remoteAddress: "127.0.0.1" },
    }) as unknown as VercelRequest;
  const body = {
    submissionId: issued.session.id,
    assessmentType: primaryAssessment(answers.selected),
    assessmentVersion: COMBINED_VERSION,
    answers,
  };
  return {
    issued,
    saved,
    load,
    ingest,
    verifyBooking,
    saveProof,
    deps,
    request,
    body,
  };
}
beforeEach(() => _resetRateLimitStateForTests());
describe("premium assessment HTTP boundary", () => {
  it("is off unless both server-only release settings are configured", async () => {
    const f = setup(),
      r = response();
    await premiumAssessmentHttp(f.request("report"), r.res, {
      ...f.deps,
      env: {},
    });
    expect(r.state.status).toBe(503);
    expect(f.load).not.toHaveBeenCalled();
  });
  it("issues an HttpOnly signed session without disclosing reports or contact data", async () => {
    const f = setup(),
      r = response();
    await premiumAssessmentHttp(f.request("start"), r.res, f.deps);
    expect(r.state.status).toBe(200);
    expect(r.state.headers["Set-Cookie"]).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
    expect(Object.keys(r.state.body as object)).toEqual(["ok", "submissionId"]);
    expect(r.state.headers["Cache-Control"]).toContain("no-store");
  });
  it("rejects cross-origin writes and unsigned or mismatched assessment sessions", async () => {
    const f = setup();
    const cross = f.request("save", f.body);
    cross.headers.origin = "https://other.example";
    let r = response();
    await premiumAssessmentHttp(cross, r.res, f.deps);
    expect(r.state.status).toBe(403);
    const forged = f.request("report");
    forged.headers.cookie = `${assessmentCookieName(f.issued.session.id)}=forged`;
    r = response();
    await premiumAssessmentHttp(forged, r.res, f.deps);
    expect(r.state.status).toBe(401);
    const other = f.request("report");
    other.query.assessment = issueAssessmentSession(secret, now).session.id;
    r = response();
    await premiumAssessmentHttp(other, r.res, f.deps);
    expect(r.state.status).toBe(401);
    expect(f.load).not.toHaveBeenCalled();
  });
  it("never unlocks on a stored flag or client-supplied booking claim", async () => {
    const f = setup();
    f.saved.derived.bookingVerification = { booked: true };
    const req = f.request("report", { booked: true });
    const r = response();
    await premiumAssessmentHttp(req, r.res, f.deps);
    expect(r.state.status).toBe(423);
    expect(r.state.body).toEqual({
      ok: false,
      code: "booking_required",
      selected: f.saved.answers.selected,
      preliminary: expect.any(Array),
    });
    expect(JSON.stringify(r.state.body)).not.toMatch(
      /diagnostic|overallScore|preview@example/,
    );
    expect(f.saveProof).not.toHaveBeenCalled();
  });
  it("does not resubmit a saved assessment on retry and rejects changed answers", async () => {
    const f = setup();
    let r = response();
    await premiumAssessmentHttp(f.request("save", f.body), r.res, f.deps);
    expect(r.state.status).toBe(200);
    expect(f.ingest).not.toHaveBeenCalled();
    const changed = {
      ...f.body,
      answers: { ...f.saved.answers, locale: "es" },
    };
    r = response();
    await premiumAssessmentHttp(f.request("save", changed), r.res, f.deps);
    expect(r.state.status).toBe(409);
    expect(f.ingest).not.toHaveBeenCalled();
  });
  it("uses the same server-issued submission ID for one combined ingest", async () => {
    const f = setup();
    f.load.mockResolvedValueOnce(null).mockResolvedValue(f.saved);
    const r = response();
    await premiumAssessmentHttp(f.request("save", f.body), r.res, f.deps);
    expect(r.state.status).toBe(200);
    expect(f.ingest).toHaveBeenCalledTimes(1);
    expect(f.ingest.mock.calls[0][0].submissionId).toBe(f.issued.session.id);
    expect(r.state.body).not.toHaveProperty("results");
  });
  it("releases only the authorized report after provider verification and TAC checkpoint success", async () => {
    const f = setup();
    f.verifyBooking.mockResolvedValue({
      eventId: "verified-event",
      contactId: "verified-contact",
      calendarId: "verified-calendar",
      startTime: "2026-10-21T18:00:00Z",
      verifiedAt: "2026-10-20T18:00:00Z",
    });
    let r = response();
    await premiumAssessmentHttp(f.request("report"), r.res, f.deps);
    expect(r.state.status).toBe(200);
    expect(f.verifyBooking).toHaveBeenCalledWith(
      f.saved.answers,
      Date.parse(f.saved.submittedAt),
    );
    expect(f.saveProof).toHaveBeenCalledTimes(1);
    expect(r.state.body).toHaveProperty("results");
    expect(JSON.stringify(r.state.body)).not.toContain("preview@example.com");
    f.saveProof.mockResolvedValue(false);
    r = response();
    await premiumAssessmentHttp(f.request("report"), r.res, f.deps);
    expect(r.state.status).toBe(409);
    expect(r.state.body).not.toHaveProperty("results");
  });
  it("fails closed on provider errors and supports saved bilingual result snapshots", async () => {
    const f = setup();
    f.verifyBooking.mockRejectedValueOnce(new Error("provider unavailable"));
    let r = response();
    await premiumAssessmentHttp(f.request("report"), r.res, f.deps);
    expect(r.state.status).toBe(503);
    expect(r.state.body).not.toHaveProperty("results");
    f.verifyBooking.mockResolvedValue({ eventId: "event" });
    const req = f.request("report");
    req.query.lang = "es";
    r = response();
    await premiumAssessmentHttp(req, r.res, f.deps);
    expect(r.state.status).toBe(200);
    expect(
      (r.state.body as { results: { title: string }[] }).results.find(r=>r.title.includes("familia"))?.title,
    ).toBe("Proteger a mi familia");
  });
});


it('restricts hosted QA to preview deployments and synthetic contacts',async()=>{
 const f=setup();f.deps.env={...env,VALTORIS_HOSTED_QA:'true',VERCEL_ENV:'production'};
 let r=response();await premiumAssessmentHttp(f.request('report'),r.res,f.deps);expect(r.state.status).toBe(503);expect(f.load).not.toHaveBeenCalled();
 f.deps.env={...env,VALTORIS_HOSTED_QA:'true',VERCEL_ENV:'preview'};
 f.saved.answers.contact.email='real-contact@example.com';
 r=response();await premiumAssessmentHttp(f.request('report'),r.res,f.deps);expect(r.state.status).toBe(403);
 r=response();await premiumAssessmentHttp(f.request('save',f.body),r.res,f.deps);expect(r.state.status).toBe(400);expect(f.ingest).not.toHaveBeenCalled();
});

it('allows synthetic-only staged QA on its exact generated host',async()=>{
 const f=setup();f.deps.env={...env,VALTORIS_HOSTED_QA:'true',VALTORIS_HOSTED_QA_STAGED:'true',VERCEL_ENV:'production',VERCEL_URL:'qa.valtoris.vercel.app'};
 let req=f.request('report');req.headers.host='www.valtorisfinancial.com';let r=response();
 await premiumAssessmentHttp(req,r.res,f.deps);expect(r.state.status).toBe(503);expect(f.load).not.toHaveBeenCalled();
 req=f.request('report');req.headers.host='qa.valtoris.vercel.app';f.saved.answers.contact.email='real@example.com';r=response();
 await premiumAssessmentHttp(req,r.res,f.deps);expect(r.state.status).toBe(403);
});
