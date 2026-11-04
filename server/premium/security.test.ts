import { describe, expect, it } from "vitest";
import {
  issueAssessmentSession,
  readAssessmentSession,
  assessmentCookie,
} from "./session";
import { verifiedBookingEvent, PREMIUM_CALENDARS } from "./booking";
const secret = "test-only-key-with-at-least-32-characters";
const now = Date.parse("2026-10-20T15:00:00Z");
const event = {
  id: "test-event",
  contactId: "test-contact",
  locationId: "test-location",
  calendarId: PREMIUM_CALENDARS[0],
  appointmentStatus: "confirmed",
  startTime: "2026-10-21T15:00:00-05:00",
};
describe("assessment result access", () => {
  it("requires an intact unexpired server-issued assessment session", () => {
    const issued = issueAssessmentSession(secret, now);
    expect(readAssessmentSession(issued.token, secret, now)).toEqual(
      issued.session,
    );
    expect(readAssessmentSession(`${issued.token}x`, secret, now)).toBeNull();
    expect(
      readAssessmentSession(
        issued.token,
        "another-key-with-at-least-32-characters",
        now,
      ),
    ).toBeNull();
    expect(
      readAssessmentSession(issued.token, secret, now + 8 * 86400000),
    ).toBeNull();
    expect(assessmentCookie(issued.token, issued.session.id)).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
  });
  it("continues to recognize a completed consultation tied to this assessment, but rejects unrelated old bookings", () => {
    const attended = {
      ...event,
      appointmentStatus: "showed",
      startTime: "2026-10-20T16:00:00Z",
    };
    expect(
      verifiedBookingEvent(
        { event: attended },
        "test-contact",
        "test-location",
        now + 86400000,
        now,
      ),
    ).not.toBeNull();
    expect(
      verifiedBookingEvent(
        { event: { ...attended, startTime: "2026-10-19T16:00:00Z" } },
        "test-contact",
        "test-location",
        now + 86400000,
        now,
      ),
    ).toBeNull();
  });
  it("requires the trusted provider to match contact, location, calendar, status and future time", () => {
    expect(
      verifiedBookingEvent({ event }, "test-contact", "test-location", now),
    ).not.toBeNull();
    for (const patch of [
      { contactId: "other" },
      { locationId: "other" },
      { calendarId: "other" },
      { appointmentStatus: "cancelled" },
      { appointmentStatus: "noshow" },
      { startTime: "2026-10-21 15:00:00" },
      { startTime: "2026-10-19T15:00:00Z" },
    ]) {
      expect(
        verifiedBookingEvent(
          { event: { ...event, ...patch } },
          "test-contact",
          "test-location",
          now,
        ),
      ).toBeNull();
    }
    expect(
      verifiedBookingEvent(
        { booked: true },
        "test-contact",
        "test-location",
        now,
      ),
    ).toBeNull();
  });
});
