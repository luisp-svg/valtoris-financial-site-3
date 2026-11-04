/** Explicit local QA export only. Never imported by the public booking API. */
export type QaBooking = {
  requestId: string
  submissionId: string
  contactKey: string
  email: string
  calendarId: string
  startTime: string
  endTime: string
}
export type ExportCheckpoint = { started: boolean; externalId: string | null }
export interface TacBookingQueue {
  save(input: QaBooking): Promise<void>
  load(requestId: string): Promise<QaBooking | null>
  contactCheckpoint(contactKey: string): Promise<ExportCheckpoint>
  eventCheckpoint(requestId: string): Promise<ExportCheckpoint>
  claimContact(contactKey: string): Promise<boolean>
  claimEvent(requestId: string): Promise<boolean>
  linkContact(contactKey: string, externalId: string): Promise<void>
  linkEvent(requestId: string, externalId: string): Promise<void>
}
export interface SilentBookingProvider {
  /** Must re-read location/workflow/calendar/notification settings, not trust a stale flag. */
  assertSilentCalendar(calendarId: string): Promise<void>
  findContacts(input: QaBooking): Promise<string[]>
  verifyContact(input: QaBooking, contactId: string): Promise<void>
  createContact(input: QaBooking): Promise<string>
  findEvents(input: QaBooking, contactId: string): Promise<string[]>
  verifyEvent(input: QaBooking, contactId: string, eventId: string): Promise<void>
  createEvent(input: QaBooking, contactId: string): Promise<string>
}
export type ExportOutcome = { status: 'confirmed'; contactId: string; eventId: string } |
  { status: 'review_required'; reason: string }
export function assertQaBooking(input: QaBooking) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  if (![input.requestId, input.submissionId, input.contactKey].every(id => uuid.test(id)) ||
    !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/.test(input.email) ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(input.calendarId) ||
    ![input.startTime, input.endTime].every(time => /(Z|[+-]\d{2}:\d{2})$/.test(time) && Number.isFinite(Date.parse(time))) ||
    Date.parse(input.endTime) <= Date.parse(input.startTime)) throw new Error('invalid_test_booking')
}
/**
 * TAC commits intent before any provider request. A durable started marker precedes
 * each POST. After an uncertain result, reconciliation may link an exact record,
 * but absence never authorizes a second POST. This trades automatic recovery for
 * duplicate prevention when the provider has no documented idempotency key.
 */
export async function exportSilentTacBooking(
  queue: TacBookingQueue, provider: SilentBookingProvider, requestId: string,
): Promise<ExportOutcome> {
  const input = await queue.load(requestId)
  if (!input) return { status: 'review_required', reason: 'tac_request_missing' }
  assertQaBooking(input)
  await provider.assertSilentCalendar(input.calendarId)
  let contact = await queue.contactCheckpoint(input.contactKey)
  if (!contact.externalId) {
    const matches = await provider.findContacts(input)
    if (matches.length > 1) return { status: 'review_required', reason: 'duplicate_contacts' }
    if (matches.length === 1) {
      await provider.verifyContact(input, matches[0])
      await queue.linkContact(input.contactKey, matches[0])
    } else {
      if (contact.started || !await queue.claimContact(input.contactKey)) {
        return { status: 'review_required', reason: 'contact_create_uncertain_or_busy' }
      }
      // A failed request remains started. Never clear this marker on a timeout.
      const id = await provider.createContact(input)
      await provider.verifyContact(input, id)
      await queue.linkContact(input.contactKey, id)
    }
    contact = await queue.contactCheckpoint(input.contactKey)
  }
  if (!contact.externalId) return { status: 'review_required', reason: 'contact_not_linked' }
  await provider.verifyContact(input, contact.externalId)
  let event = await queue.eventCheckpoint(requestId)
  if (!event.externalId) {
    const matches = await provider.findEvents(input, contact.externalId)
    if (matches.length > 1) return { status: 'review_required', reason: 'duplicate_events' }
    if (matches.length === 1) {
      await provider.verifyEvent(input, contact.externalId, matches[0])
      await queue.linkEvent(requestId, matches[0])
    } else {
      if (event.started || !await queue.claimEvent(requestId)) {
        return { status: 'review_required', reason: 'event_create_uncertain_or_busy' }
      }
      // Check again immediately before the event POST. Workflow/calendar edits
      // between calls must fail closed; toNotify:false is also mandatory.
      await provider.assertSilentCalendar(input.calendarId)
      const id = await provider.createEvent(input, contact.externalId)
      await provider.verifyEvent(input, contact.externalId, id)
      await queue.linkEvent(requestId, id)
    }
    event = await queue.eventCheckpoint(requestId)
  }
  if (!event.externalId) return { status: 'review_required', reason: 'event_not_linked' }
  await provider.verifyEvent(input, contact.externalId, event.externalId)
  return { status: 'confirmed', contactId: contact.externalId, eventId: event.externalId }
}
