import {premiumIngest} from './qaIngest.js';
import {discoveryPlan,discoverySeed,validateDiscovery,discoverySummary,specializedNextSteps,type DiscoveryScope} from '../../modules/reportCard/funnelStrategy.js';
import { adaptiveReportCard, combinedResults } from '../../modules/reportCard/combined/results.js';
import { coverageReview } from '../../modules/reportCard/specialtyPreview/coverageReview.js'
import { projectDiagnostic } from '../../modules/reportCard/combined/engine.js'
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../../lib/supabase/admin.js";
import {
  isCombined,
  validateCombined,
  restoreStoredCombined,
  combinedAnswerRows,
  COMBINED_VERSION,
  primaryAssessment,
  type CombinedAnswers,
} from "../../modules/reportCard/combined/engine.js";
import { ingestPublicReportCard } from "../ingest/familyReportCard/ingestFamilyReportCard.js";
import { checkRateLimit } from "../ingest/familyReportCard/abuse.js";
import {
  normalizeEmail,
  normalizePhone,
} from "../../crm/households/normalizeContact.js";
import {
  assessmentCookie,
  issueAssessmentSession,
  assessmentCookieName,
  readAssessmentSession,
} from "./session.js";
import { TacBookingService, type TacBookingActions } from "./tacBookingService.js";
import { SupabaseTacBookingStore } from "./tacBookingStore.js";
import { AgentCrmBookingProvider } from "./agentCrmBookingProvider.js";
import { type BookingProof } from "./booking.js";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export type SavedAssessment = {
  id: string;
  updatedAt: string;
  submittedAt: string;
  answers: CombinedAnswers;
  derived: Record<string, unknown>;
};
export type PremiumDeps = {
  onBookingError?: (category: string) => void;
  booking?: TacBookingActions;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  load?: (submissionId: string) => Promise<SavedAssessment | null>;
  ingest?: typeof ingestPublicReportCard;
  verifyBooking?: (
    answers: CombinedAnswers,
    notBefore: number,
  ) => Promise<BookingProof | null>;
  saveDiscovery?: (saved: SavedAssessment, discovery: Record<string, unknown>) => Promise<boolean>;
  saveProof?: (saved: SavedAssessment, proof: BookingProof) => Promise<boolean>;
};
function repository(admin: SupabaseClient) {
  return {
    async load(submissionId: string): Promise<SavedAssessment | null> {
      const leadResult = await admin
        .from("leads")
        .select("id,normalized_email,normalized_phone,raw_payload")
        .eq("public_ingest_idempotency_key", submissionId)
        .is("deleted_at", null)
        .maybeSingle();
      if (leadResult.error) throw new Error("assessment_load_failed");
      if (!leadResult.data) return null;
      const lead = leadResult.data;
      const result = await admin
        .from("assessments")
        .select("id,answers,derived_metrics,updated_at,completed_at")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .limit(2);
      if (result.error || result.data?.length !== 1)
        throw new Error("assessment_load_failed");
      const row = result.data[0],
        saved = record(row.answers),
        raw = record(lead.raw_payload);
      const answers = restoreStoredCombined({
        ...saved,
        contact: {
          fullName:
            `${String(raw.firstName ?? "")} ${String(raw.lastName ?? "")}`.trim(),
          email: lead.normalized_email,
          phone: lead.normalized_phone ?? "",
        },
      });
      if (
        !answers ||
        !Array.isArray(record(row.derived_metrics).combinedReportResults)
      )
        throw new Error("assessment_load_failed");
      return {
        id: row.id,
        updatedAt: row.updated_at,
        submittedAt: row.completed_at,
        answers,
        derived: record(row.derived_metrics),
      };
    },
    async saveDiscovery(saved:SavedAssessment, discovery:Record<string,unknown>):Promise<boolean>{
      const result=await admin.from("assessments").update({derived_metrics:{...saved.derived,comprehensiveDiscovery:discovery,funnelJourney:{...record(saved.derived.funnelJourney),stage:"discovery_completed",discoveryCompletedAt:discovery.completedAt}}}).eq("id",saved.id).eq("updated_at",saved.updatedAt).is("deleted_at",null).select("id");
      if(result.error)throw new Error("discovery_save_failed");
      return result.data?.length===1;
    },
    async saveProof(
      saved: SavedAssessment,
      proof: BookingProof,
    ): Promise<boolean> {
      // Optimistic concurrency protects staff edits. No new appointment/contact/automation.
      const result = await admin
        .from("assessments")
        .update({
          derived_metrics: { ...saved.derived, bookingVerification: proof },
        })
        .eq("id", saved.id)
        .eq("updated_at", saved.updatedAt)
        .is("deleted_at", null)
        .select("id");
      if (result.error) throw new Error("booking_sync_failed");
      return result.data?.length === 1;
    },
  };
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function sameAssessment(
  left: CombinedAnswers,
  right: CombinedAnswers,
): boolean {
  return (
    stable({ ...left, contact: undefined }) ===
      stable({ ...right, contact: undefined }) &&
    normalizeEmail(left.contact.email) ===
      normalizeEmail(right.contact.email) &&
    normalizePhone(left.contact.phone) ===
      normalizePhone(right.contact.phone) &&
    left.contact.fullName.trim().toLowerCase() ===
      right.contact.fullName.trim().toLowerCase()
  );
}
export async function premiumAssessmentHttp(
  req: VercelRequest,
  res: VercelResponse,
  deps: PremiumDeps = {},
) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vary", "Cookie");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const env = deps.env ?? process.env,
    now = deps.now?.() ?? Date.now();
  // Explicit server-only launch switch. Never enabled implicitly by the frontend build.
  if (
    env.VALTORIS_PREMIUM_ENABLED !== "true" ||
    (env.VALTORIS_ASSESSMENT_SESSION_SECRET?.length ?? 0) < 32
  )
    return res.status(503).json({ ok: false, code: "assessment_unavailable" });
  const hostedQa = env.VALTORIS_HOSTED_QA === "true";
  const stagedQaHost = env.VALTORIS_HOSTED_QA_STAGED === "true" &&
    env.VERCEL_ENV === "production" &&
    typeof req.headers.host === "string" &&
    req.headers.host === env.VERCEL_URL &&
    req.headers.host.endsWith(".vercel.app");
  if (hostedQa && env.VERCEL_ENV !== "preview" && !stagedQaHost)
    return res.status(503).json({ok:false,code:"qa_preview_required"});
  const action = req.query.action;
  if (!["start", "save", "report", "slots", "book", "discovery", "save-discovery"].includes(String(action)))
    return res.status(400).json({ ok: false, code: "invalid_action" });
  const expectedMethod = action === "report" || action === "slots" || action === "discovery" ? "GET" : "POST";
  if (req.method !== expectedMethod) {
    res.setHeader("Allow", expectedMethod);
    return res.status(405).json({ ok: false, code: "method_not_allowed" });
  }
  const origin = req.headers.origin;
  if (req.method === "POST") {
    try {
      if (
        typeof origin !== "string" ||
        new URL(origin).host !== req.headers.host ||
        (new URL(origin).protocol !== "https:" &&
          !/^localhost(:|$)|^127\.0\.0\.1(:|$)/.test(String(req.headers.host)))
      )
        return res.status(403).json({ ok: false, code: "origin_rejected" });
    } catch {
      return res.status(403).json({ ok: false, code: "origin_rejected" });
    }
  }
  if (
    req.method === "POST" &&
    !String(req.headers["content-type"] ?? "")
      .toLowerCase()
      .includes("application/json")
  )
    return res.status(400).json({ ok: false, code: "invalid_content_type" });
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
  ).split(",")[0];
  if (!checkRateLimit(`premium:${ip}`, now).allowed)
    return res.status(429).json({ ok: false, code: "rate_limited" });
  if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 100_000)
    return res.status(413).json({ ok: false, code: "payload_too_large" });
  const secret = env.VALTORIS_ASSESSMENT_SESSION_SECRET!;
  if (action === "start") {
    const issued = issueAssessmentSession(secret, now);
    res.setHeader(
      "Set-Cookie",
      assessmentCookie(issued.token, issued.session.id),
    );
    return res.status(200).json({ ok: true, submissionId: issued.session.id });
  }
  const requestedId =
    (action === "save" || action === "book" || action === "save-discovery") ? record(req.body).submissionId : req.query.assessment;
  if (typeof requestedId !== "string" || !/^[0-9a-f-]{36}$/.test(requestedId))
    return res
      .status(401)
      .json({ ok: false, code: "assessment_session_required" });
  const name = assessmentCookieName(requestedId);
  const cookie =
    String(req.headers.cookie ?? "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? "";
  const session = readAssessmentSession(cookie, secret, now);
  if (!session || session.id !== requestedId)
    return res
      .status(401)
      .json({ ok: false, code: "assessment_session_required" });
  try {
    const repo =
      deps.load && deps.saveProof && (action!=="save-discovery" || deps.saveDiscovery)
        ? null
        : repository(createSupabaseAdminClient());
    const load = deps.load ?? repo!.load,
      saveProof = deps.saveProof ?? repo!.saveProof;
    let saved = await load(session.id);
    if (action === "save") {
      const body = record(req.body);
      const answers = validateCombined(body.answers);
      if (hostedQa && !String(answers?.contact.email ?? '').endsWith('@example.invalid'))
        return res.status(400).json({ok:false,code:"qa_synthetic_contact_required"});
      if (
        body.submissionId !== session.id ||
        body.assessmentVersion !== (answers?.format==='combined-priorities-v1'?6:COMBINED_VERSION) ||
        !answers ||
        body.assessmentType !== primaryAssessment(answers.selected)
      )
        return res.status(400).json({ ok: false, code: "invalid_assessment" });
      if (saved && !sameAssessment(saved.answers, answers))
        return res
          .status(409)
          .json({ ok: false, code: "assessment_already_saved" });
      if (!saved) {
        const result = await (deps.ingest ?? premiumIngest(hostedQa))(body);
        if (!result.ok)
          return res.status(400).json({ ok: false, code: result.code });
        saved = await load(session.id);
        if (!saved) throw new Error("assessment_load_failed");
      }
      if (!sameAssessment(saved.answers, answers))
        return res
          .status(409)
          .json({ ok: false, code: "assessment_already_saved" });
      return res
        .status(200)
        .json({ ok: true, saved: true, next: "/assessment-results" });
    }
    if (!saved || !isCombined(saved.answers))
      return res.status(404).json({ ok: false, code: "assessment_not_found" });
    if (hostedQa && !saved.answers.contact.email.endsWith('@example.invalid'))
      return res.status(403).json({ok:false,code:"qa_synthetic_contact_required"});
    if(action==="discovery" || action==="save-discovery"){
      if(saved.answers.consultationOnly)return res.status(400).json({ok:false,code:"specialized_assessment_required"});
      const scope=action==="discovery"?req.query.scope:record(req.body).scope;
      if(scope!=="family"&&scope!=="business")return res.status(400).json({ok:false,code:"invalid_discovery_scope"});
      const previous=record(saved.derived.comprehensiveDiscovery);
      const previousAnswers=discoverySeed(saved.answers,previous.diagnostic);
      if(action==="discovery")return res.status(200).json({ok:true,...discoveryPlan(scope,saved.answers,previousAnswers),completed:previous.scope===scope,summary:previous.scope===scope?discoverySummary(scope,previousAnswers,saved.answers.locale):null});
      const validated=validateDiscovery(scope,saved.answers,record(req.body).diagnostic,previousAnswers);
      const diagnostic=validated?{...previousAnswers,...validated}:null;
      if(!diagnostic)return res.status(400).json({ok:false,code:"invalid_discovery_answers"});
      // Retry is a no-op; do not emit another task, contact, appointment, or outbound event.
      if(previous.rating&&previous.scope===scope&&stable(previousAnswers)===stable(diagnostic))return res.status(200).json({ok:true,saved:true,summary:discoverySummary(scope,diagnostic,saved.answers.locale)});
      const discovery={version:1,scope:scope as DiscoveryScope,diagnostic,completedAt:new Date(now).toISOString(),sourceSubmissionId:session.id,...discoverySummary(scope,diagnostic,saved.answers.locale)};
      if(!await (deps.saveDiscovery??repo!.saveDiscovery)(saved,discovery))return res.status(409).json({ok:false,code:"discovery_changed_retry"});
      return res.status(200).json({ok:true,saved:true,summary:discoverySummary(scope,diagnostic,saved.answers.locale)});
    }
    const tacEnabled = env.VALTORIS_TAC_BOOKING_ENABLED === "true";
    const tac = () => deps.booking ?? new TacBookingService(
      new SupabaseTacBookingStore(createSupabaseAdminClient()),
      new AgentCrmBookingProvider(env),
    );
    if (action === "slots" || action === "book") {
      if (!tacEnabled) return res.status(503).json({ok:false,code:"tac_booking_unavailable"});
      if (action === "slots") {
        const day = typeof req.query.day === "string" ? req.query.day : "";
        const timezone = typeof req.query.timezone === "string" ? req.query.timezone : "";
        const options = await tac().slots(session.id, saved.answers, day, timezone);
        return res.status(200).json({ok:true,...options});
      }
      const body = record(req.body);
      if (typeof body.startTime !== "string" || typeof body.timezone !== "string")
        return res.status(400).json({ok:false,code:"invalid_booking_time"});
      const service = tac();
      const booking = await service.book(session.id, saved.answers, body.startTime, body.timezone);
      // Immediate results no longer poll booking verification. Persist the verified
      // handoff here so the advisor sees the same booking on the original record.
      if (saved.answers.strategyVersion === 1 && booking.state === "confirmed") {
        const proof = await service.verify(session.id);
        if (!proof) return res.status(202).json({ok:true,state:"pending",startTime:booking.startTime});
        if (!await saveProof(saved, proof)) return res.status(409).json({ok:false,code:"retry_booking_sync"});
      }
      return res.status(booking.state === "confirmed" ? 200 : 202).json({ok:true,...booking});
    }
    const immediateResults=saved.answers.strategyVersion===1&&!saved.answers.consultationOnly;
    // TAC mode only accepts the appointment linked to this saved submission.
    // An unrelated pre-existing provider booking cannot unlock these results.
    if (!immediateResults && !tacEnabled && !deps.verifyBooking) return res.status(503).json({ok:false,code:"tac_booking_unavailable"});
    const proof = immediateResults ? null : tacEnabled ? await tac().verify(session.id) : await deps.verifyBooking!(
      saved.answers,
      Date.parse(saved.submittedAt),
    );
    if (!proof && !immediateResults)
      return res
        .status(423)
        .json({
          ok: false,
          code: "booking_required",
          selected: saved.answers.selected,
          ...(saved.answers.consultationOnly ? {consultationOnly:true} : {}),
          preliminary: (saved.answers.consultationOnly ? [] : saved.answers.selected).filter(type=>type==='health'||type==='benefits').map(type=>{const review=coverageReview(type,projectDiagnostic(type,saved.answers.diagnostic),req.query.lang==='es'?'es':req.query.lang==='en'?'en':saved.answers.locale)!;return {type,verificationLabel:review.verificationLabel,coverageStatus:review.coverageStatus,actions:review.actions,urgent:review.urgent}}),
        });
    if (proof && !(await saveProof(saved, proof)))
      return res.status(409).json({ ok: false, code: "retry_booking_sync" });
    const locale =
      req.query.lang === "es"
        ? "es"
        : req.query.lang === "en"
          ? "en"
          : saved.answers.locale;
    const storedResults = saved.answers.strategyVersion===1 ? combinedResults({...saved.answers,locale}) : record(saved.derived.combinedReportResultsByLocale)[locale] ?? saved.derived.combinedReportResults;
    const publicResults = Array.isArray(storedResults) ? storedResults.map(raw => {
      const review = record(raw), result = record(review.result), coverage = record(result.coverageReview);
      if (!('internal' in coverage)) return raw;
      const {internal:_internal,...summary} = coverage;
      return {...review,result:{...result,coverageReview:summary}};
    }) : [];
    return res
      .status(200)
      .json({
        ok: true,
        selected: saved.answers.selected,
          ...(saved.answers.consultationOnly ? {consultationOnly:true} : {}),
        results: publicResults,
        strategyVersion:saved.answers.strategyVersion??null,
        cardVersion:saved.answers.cardVersion??null,
        nextSteps:specializedNextSteps(saved.answers),
        discovery:saved.derived.comprehensiveDiscovery??null,
        financialReportCard: adaptiveReportCard({...saved.answers,locale}),
        answerRows: combinedAnswerRows(saved.answers, locale),
      });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (action === "book" || action === "slots" || action === "report") deps.onBookingError?.(/^(booking_|tac_|invalid_)[a-z0-9_]{1,80}$/.test(code) ? code : "booking_unclassified_failure");
    if (["invalid_booking_date","invalid_booking_time"].includes(code)) return res.status(400).json({ok:false,code});
    if (["booking_slot_unavailable","booking_already_reserved","booking_identity_review_required","booking_duplicate_events_review"].includes(code))
      return res.status(409).json({ok:false,code});
    return res
      .status(503)
      .json({ ok: false, code: "verification_unavailable" });
  }
}
