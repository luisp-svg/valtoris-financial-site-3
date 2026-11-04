import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { combinedFixture } from "./testFixtures";
import { findVerifiedBooking, PREMIUM_CALENDARS } from "./booking";
const identity = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../agentcrm/identityLookup.js", () => ({
  lookupAgentCrmIdentity: identity.read,
}));
const now = Date.parse("2026-10-21T18:00:00Z");
const event = {
  id: "event1",
  contactId: "contact1",
  locationId: "testlocation",
  calendarId: PREMIUM_CALENDARS[0],
  appointmentStatus: "confirmed",
  startTime: "2026-10-22T18:00:00Z",
};
beforeEach(() => {
  vi.stubEnv(
    "AGENTCRM_PRIVATE_INTEGRATION_TOKEN",
    "test-only-not-a-real-token",
  );
  vi.stubEnv("AGENTCRM_LOCATION_ID", "testlocation");
  identity.read
    .mockReset()
    .mockResolvedValue({
      status: "EXACT_EXISTING_CONTACT",
      externalContactId: "contact1",
    });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each(["home_buyer", "tsp"] as const)(
  "%s verifies provider appointment detail with correct API versions and GET-only requests",
  async (type) => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).includes("/contacts/")
              ? { events: [event] }
              : { appointment: event },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchImpl);
    expect(
      await findVerifiedBooking(combinedFixture([type]), now, now),
    ).toMatchObject({
      eventId: "event1",
      contactId: "contact1",
      calendarId: PREMIUM_CALENDARS[0],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      String(fetchImpl.mock.calls[0][0]).endsWith(
        "/contacts/contact1/appointments",
      ),
    ).toBe(true);
    expect(
      String(fetchImpl.mock.calls[1][0]).endsWith(
        "/calendars/events/appointments/event1",
      ),
    ).toBe(true);
    const calls = fetchImpl.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[0][1].headers).toHaveProperty("Version", "2021-07-28");
    expect(calls[1][1].headers).toHaveProperty("Version", "2021-04-15");
    for (const [, options] of calls) {
      expect(options.method).toBe("GET");
      expect(options.body).toBeUndefined();
    }
  },
);
it("does not trust a stale confirmed list entry after the provider cancels the actual appointment", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).includes("/contacts/")
              ? { events: [event] }
              : { event: { ...event, appointmentStatus: "cancelled" } },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
  expect(
    await findVerifiedBooking(combinedFixture(["tsp"]), now, now),
  ).toBeNull();
});
it("holds ambiguous identity without reading any appointment or writing a contact", async () => {
  identity.read.mockResolvedValue({
    status: "AMBIGUOUS",
    reason: "MULTIPLE_CONTACTS",
  });
  const fetchImpl = vi.fn();
  vi.stubGlobal("fetch", fetchImpl);
  expect(
    await findVerifiedBooking(combinedFixture(["home_buyer"]), now, now),
  ).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});
it("fails closed on provider permission errors without exposing results", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 403 })),
  );
  await expect(
    findVerifiedBooking(combinedFixture(["tsp"]), now, now),
  ).rejects.toThrow();
});
