import { lookupAgentCrmIdentity } from "../agentcrm/identityLookup.js";
import { LeadConnectorClient } from "../agentcrm/client.js";
import { readAgentCrmConfig } from "../agentcrm/config.js";
import type { CombinedAnswers } from "../../modules/reportCard/combined/engine.js";
import { splitFullName } from "../../utils/submitLeadToGoogleSheets.js";
export const PREMIUM_CALENDARS = [
  "aM4Wwt4WNABaaoGNT5qQ",
  "Ln1RKtSCFS0HdKTfoX4q",
  "3FFPZLEp8mOjqxZlFvnw",
] as const;
export type BookingProof = {
  eventId: string;
  contactId: string;
  calendarId: string;
  startTime: string;
  verifiedAt: string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
/** Trusted API response only. A client flag, callback or iframe message never qualifies. */
export function verifiedBookingEvent(
  raw: unknown,
  contactId: string,
  locationId: string,
  now = Date.now(),
  notBefore = now,
): BookingProof | null {
  const response = object(raw);
  const event = object(response.event ?? response.appointment);
  if (
    event.contactId !== contactId ||
    event.locationId !== locationId ||
    !PREMIUM_CALENDARS.includes(
      event.calendarId as (typeof PREMIUM_CALENDARS)[number],
    )
  )
    return null;
  if (typeof event.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.id))
    return null;
  const status = event.appointmentStatus ?? event.status;
  if (!["new", "confirmed", "booked", "showed"].includes(String(status)))
    return null;
  // Reject timezone-less strings rather than interpreting them in the server's timezone.
  if (
    typeof event.startTime !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(event.startTime) ||
    !Number.isFinite(Date.parse(event.startTime)) ||
    !Number.isFinite(notBefore) ||
    Date.parse(event.startTime) < notBefore
  )
    return null;
  return {
    eventId: event.id,
    contactId,
    calendarId: String(event.calendarId),
    startTime: event.startTime,
    verifiedAt: new Date(now).toISOString(),
  };
}
/** Read-only polling avoids adding a second calendar-triggered automation path. */
export async function findVerifiedBooking(
  answers: CombinedAnswers,
  notBefore: number,
  now = Date.now(),
): Promise<BookingProof | null> {
  const config = readAgentCrmConfig();
  if (!config.configured) throw new Error("booking_verification_unavailable");
  const client = new LeadConnectorClient({ token: config.token });
  // Calendar event reads use a different documented version from contact reads.
  const calendarClient = new LeadConnectorClient({
    token: config.token,
    apiVersion: "2021-04-15",
  });
  const identity = await lookupAgentCrmIdentity(client, config.locationId, {
    ...splitFullName(answers.contact.fullName),
    email: answers.contact.email,
    phone: answers.contact.phone,
  });
  if (identity.status === "INTEGRATION_ERROR")
    throw new Error("booking_verification_unavailable");
  if (identity.status !== "EXACT_EXISTING_CONTACT") return null;
  const contactId = identity.externalContactId;
  const response = object(
    await client.get(`/contacts/${contactId}/appointments`),
  );
  if (!Array.isArray(response.events))
    throw new Error("booking_verification_unavailable");
  const candidates = response.events
    .map(object)
    .filter(
      (event) =>
        PREMIUM_CALENDARS.includes(
          event.calendarId as (typeof PREMIUM_CALENDARS)[number],
        ) &&
        typeof event.id === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(event.id) &&
        !["cancelled", "canceled", "noshow", "invalid"].includes(
          String(event.appointmentStatus ?? event.status),
        ) &&
        (!Number.isFinite(Date.parse(String(event.startTime))) ||
          Date.parse(String(event.startTime)) >= notBefore),
    )
    .sort(
      (a, b) =>
        (Date.parse(String(a.startTime)) || Number.MAX_SAFE_INTEGER) -
        (Date.parse(String(b.startTime)) || Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 5);
  const proofs = await Promise.all(
    candidates.map(async (candidate) =>
      verifiedBookingEvent(
        await calendarClient.get(
          `/calendars/events/appointments/${candidate.id}`,
        ),
        contactId,
        config.locationId,
        now,
        notBefore,
      ),
    ),
  );
  return proofs.find((proof): proof is BookingProof => proof !== null) ?? null;
}
