import { assertAgentCrmServerOnly } from './config.js'
import { assertQaBooking, type QaBooking, type SilentBookingProvider } from '../premium/silentTacBooking.js'

export const SILENT_QA_CALENDAR_NAME = 'Valtoris QA — Silent Booking Tests'
const LOCATION = 'I2Y36c45rBLFZhCQwkDC'
const API = 'https://services.leadconnectorhq.com'
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const source = (input: QaBooking) => `Valtoris Local QA ${input.contactKey}`
const title = (input: QaBooking) => `TAC QA ${input.requestId}`

/** Local test harness only. No tags, workflows, messages, opportunities or tasks. */
export class SilentTestBookingClient implements SilentBookingProvider {
  constructor(private readonly settings: {
    token: string
    locationId: string
    calendarId: string
    allowTestWrites: boolean
  }, private readonly fetchImpl: typeof fetch = fetch) {
    assertAgentCrmServerOnly()
    if (!settings.token.trim() || settings.locationId !== LOCATION || !idPattern.test(settings.calendarId)) throw new Error('invalid_silent_test_config')
  }
  private async request(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, calendarEvent = false) {
    const allowed = method === 'GET'
      ? /^\/locations\/[\w-]+$/.test(path) || path.startsWith('/workflows/?locationId=') ||
        /^\/calendars\/[\w-]+(?:\/notifications)?$/.test(path) || path.startsWith('/contacts/?') ||
        /^\/contacts\/[\w-]+(?:\/appointments)?$/.test(path) || /^\/calendars\/events\/appointments\/[\w-]+$/.test(path)
      : path === '/contacts/' || path === '/calendars/events/appointments'
    if (!allowed) throw new Error('silent_test_endpoint_forbidden')
    if (method === 'POST' && !this.settings.allowTestWrites) throw new Error('silent_test_writes_disabled')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await this.fetchImpl(API + path, { method, redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${this.settings.token}`, Accept: 'application/json',
          Version: calendarEvent ? '2021-04-15' : '2021-07-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) throw new Error(`silent_test_http_${response.status}`)
      try { return await response.json() as unknown } catch { throw new Error('silent_test_invalid_response') }
    } catch (error) {
      // Never surface provider bodies, credentials or arbitrary fetch errors.
      if (error instanceof Error && /^silent_test_/.test(error.message)) throw error
      throw new Error(controller.signal.aborted ? 'silent_test_timeout' : 'silent_test_network_error')
    } finally { clearTimeout(timer) }
  }
  async assertSilentCalendar(calendarId: string) {
    if (calendarId !== this.settings.calendarId) throw new Error('silent_test_calendar_not_allowlisted')
    const location = record(record(await this.request('GET', `/locations/${LOCATION}`)).location)
    if (location.id !== LOCATION) throw new Error('silent_test_location_mismatch')
    const workflows = record(await this.request('GET', `/workflows/?locationId=${LOCATION}`))
    if (!Array.isArray(workflows.workflows) || workflows.workflows.some(w => record(w).status !== 'draft') ||
      workflows.nextPage || workflows.nextPageUrl || record(workflows.meta).nextPageUrl) throw new Error('silent_test_workflows_not_safe')
    const calendar = record(record(await this.request('GET', `/calendars/${calendarId}`)).calendar)
    // A QA event calendar has no staff assignments, hence no linked staff calendar.
    // Never temporarily disable a production calendar to make a test pass.
    if (calendar.id !== calendarId || calendar.locationId !== LOCATION || calendar.name !== SILENT_QA_CALENDAR_NAME ||
      calendar.calendarType !== 'event' || !Array.isArray(calendar.teamMembers) || calendar.teamMembers.length !== 0 ||
      calendar.googleInvitationEmails !== false || calendar.shouldSendAlertEmailsToAssignedMember === true || calendar.alertEmail ||
      calendar.linkedCalendar || calendar.linkedCalendars || calendar.isLivePaymentMode === true || calendar.enableRecurring === true) {
      throw new Error('silent_test_calendar_not_isolated')
    }
    const notifications = await this.request('GET', `/calendars/${calendarId}/notifications`)
    if (!Array.isArray(notifications) || notifications.some(n => {
      const row = record(n)
      return row.deleted !== true && row.isActive !== false
    })) throw new Error('silent_test_notifications_not_off')
  }
  async findContacts(input: QaBooking): Promise<string[]> {
    assertQaBooking(input)
    // Bounded query must be complete; truncated results block delivery. This
    // legacy read endpoint remains supported, but can be replaced independently.
    const result = record(await this.request('GET', `/contacts/?${new URLSearchParams({ locationId: LOCATION, query: input.email, limit: '100' })}`))
    if (!Array.isArray(result.contacts)) throw new Error('silent_test_contact_search_invalid')
    const meta = record(result.meta)
    const total = result.count ?? meta.total
    if (typeof total !== 'number' || total !== result.contacts.length || total >= 100 || (meta.nextPage !== undefined && meta.nextPage !== null && meta.nextPage !== '')) throw new Error('silent_test_contact_search_incomplete')
    return result.contacts.filter(c => String(record(c).email).trim().toLowerCase() === input.email).map(c => this.id(record(c).id))
  }
  async verifyContact(input: QaBooking, contactId: string) {
    assertQaBooking(input)
    const contact = record(record(await this.request('GET', `/contacts/${this.id(contactId)}`)).contact)
    if (contact.id !== contactId || contact.locationId !== LOCATION || contact.email !== input.email ||
      contact.source !== source(input) || contact.dnd !== true || contact.phone ||
      (Array.isArray(contact.additionalEmails) && contact.additionalEmails.length > 0) ||
      (Array.isArray(contact.additionalPhones) && contact.additionalPhones.length > 0) ||
      (Array.isArray(contact.tags) && contact.tags.length > 0)) throw new Error('silent_test_contact_identity_or_dnd_mismatch')
  }
  async createContact(input: QaBooking): Promise<string> {
    assertQaBooking(input)
    await this.assertSilentCalendar(input.calendarId)
    const result = record(await this.request('POST', '/contacts/', {
      locationId: LOCATION, firstName: 'Valtoris', lastName: 'QA Test Only',
      email: input.email, source: source(input), dnd: true,
      dndSettings: { Email: { status: 'active' }, SMS: { status: 'active' }, Call: { status: 'active' } },
      // No phone, tags, owner assignment or campaign enrollment.
    }))
    return this.id(record(result.contact).id)
  }
  async findEvents(input: QaBooking, contactId: string): Promise<string[]> {
    assertQaBooking(input)
    const result = record(await this.request('GET', `/contacts/${this.id(contactId)}/appointments`))
    if (!Array.isArray(result.events) || result.nextPage || record(result.meta).nextPageUrl) throw new Error('silent_test_event_search_incomplete')
    return result.events.filter(e => record(e).title === title(input)).map(e => this.id(record(e).id))
  }
  async verifyEvent(input: QaBooking, contactId: string, eventId: string) {
    assertQaBooking(input)
    const raw = record(await this.request('GET', `/calendars/events/appointments/${this.id(eventId)}`, undefined, true))
    const event = record(raw.event || raw.appointment || raw)
    if (event.id !== eventId || event.contactId !== contactId || event.locationId !== LOCATION || event.calendarId !== input.calendarId ||
      event.title !== title(input) || Date.parse(String(event.startTime)) !== Date.parse(input.startTime) ||
      Date.parse(String(event.endTime)) !== Date.parse(input.endTime) || !['new', 'confirmed'].includes(String(event.appointmentStatus)) ||
      event.assignedUserId || (Array.isArray(event.guests) && event.guests.length > 0)) throw new Error('silent_test_event_mismatch')
  }
  async createEvent(input: QaBooking, contactId: string): Promise<string> {
    assertQaBooking(input)
    await this.verifyContact(input, contactId)
    await this.assertSilentCalendar(input.calendarId)
    if (Date.parse(input.startTime) <= Date.now()) throw new Error('silent_test_slot_in_past')
    const result = record(await this.request('POST', '/calendars/events/appointments', {
      calendarId: this.settings.calendarId, locationId: LOCATION, contactId: this.id(contactId),
      title: title(input), description: 'Local TAC QA only. No client communication authorized.',
      startTime: input.startTime, endTime: input.endTime, appointmentStatus: 'confirmed',
      toNotify: false, ignoreDateRange: false, ignoreFreeSlotValidation: false,
    }, true))
    return this.id(record(result.event || result.appointment || result).id)
  }
  private id(value: unknown): string {
    if (typeof value !== 'string' || !idPattern.test(value)) throw new Error('silent_test_invalid_id')
    return value
  }
}
