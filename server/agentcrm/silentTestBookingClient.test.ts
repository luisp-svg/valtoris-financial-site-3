import { randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { SILENT_QA_CALENDAR_NAME, SilentTestBookingClient } from './silentTestBookingClient'
import type { QaBooking } from '../premium/silentTacBooking'
const LOCATION = 'I2Y36c45rBLFZhCQwkDC'
function fixture(allowTestWrites = true) {
  const input: QaBooking = { requestId: randomUUID(), submissionId: randomUUID(), contactKey: randomUUID(),
    email: 'silent-qa@example.invalid', calendarId: 'qaCalendar', startTime: '2030-01-02T15:00:00Z', endTime: '2030-01-02T15:30:00Z' }
  const calendar: Record<string, unknown> = { id: input.calendarId, locationId: LOCATION, name: SILENT_QA_CALENDAR_NAME,
    calendarType: 'event', teamMembers: [], googleInvitationEmails: false, shouldSendAlertEmailsToAssignedMember: false }
  const contact: Record<string, unknown> = { id: 'qaContact', locationId: LOCATION, email: input.email,
    source: `Valtoris Local QA ${input.contactKey}`, dnd: true, tags: [] }
  const event: Record<string, unknown> = { id: 'qaEvent', contactId: 'qaContact', locationId: LOCATION, calendarId: input.calendarId,
    title: `TAC QA ${input.requestId}`, startTime: input.startTime, endTime: input.endTime, appointmentStatus: 'confirmed' }
  let notifications: unknown[] = [], workflows: unknown[] = [{ status: 'draft' }], searchTotal = 1
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname, method = init?.method
    let data: unknown
    if (path === `/locations/${LOCATION}`) data = { location: { id: LOCATION } }
    else if (path === '/workflows/') data = { workflows }
    else if (path === '/calendars/qaCalendar') data = { calendar }
    else if (path === '/calendars/qaCalendar/notifications') data = notifications
    else if (path === '/contacts/' && method === 'GET') data = { contacts: [contact], meta: { total: searchTotal, nextPage: '', nextPageUrl: 'https://services.leadconnectorhq.com/contacts/?startAfter=1' } }
    else if (path === '/contacts/' && method === 'POST') data = { contact }
    else if (path === '/contacts/qaContact') data = { contact }
    else if (path === '/contacts/qaContact/appointments') data = { events: [event] }
    else if (path === '/calendars/events/appointments') data = event
    else if (path === '/calendars/events/appointments/qaEvent') data = { appointment: event }
    else throw new Error('unexpected route')
    return new Response(JSON.stringify(data), { status: 200 })
  })
  const client = new SilentTestBookingClient({ token: 'fake-test-token', locationId: LOCATION, calendarId: input.calendarId, allowTestWrites }, fetchImpl)
  return { input, client, calendar, contact, event, fetchImpl,
    setNotifications: (v: unknown[]) => { notifications = v }, setWorkflows: (v: unknown[]) => { workflows = v }, setTotal: (v: number) => { searchTotal = v } }
}
it('only sends DND test identity and a notification-suppressed booking; never phones, tags or enrollments', async () => {
  const f = fixture()
  await f.client.assertSilentCalendar(f.input.calendarId)
  expect(await f.client.findContacts(f.input)).toEqual(['qaContact'])
  expect(await f.client.createContact(f.input)).toBe('qaContact')
  expect(await f.client.findEvents(f.input, 'qaContact')).toEqual(['qaEvent'])
  expect(await f.client.createEvent(f.input, 'qaContact')).toBe('qaEvent')
  await f.client.verifyEvent(f.input, 'qaContact', 'qaEvent')
  const posts = f.fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST')
  expect(posts.map(([url]) => new URL(String(url)).pathname)).toEqual(['/contacts/', '/calendars/events/appointments'])
  const contact = JSON.parse(String(posts[0][1]?.body)), event = JSON.parse(String(posts[1][1]?.body))
  expect(contact).toMatchObject({ dnd: true, email: 'silent-qa@example.invalid' })
  for (const key of ['phone', 'tags', 'assignedTo']) expect(contact).not.toHaveProperty(key)
  expect(event).toMatchObject({ toNotify: false, ignoreDateRange: false, ignoreFreeSlotValidation: false })
  for (const key of ['assignedUserId', 'guests', 'rrule']) expect(event).not.toHaveProperty(key)
})
it.each([
  { googleInvitationEmails: true }, { teamMembers: [{ userId: 'realAdvisor' }] }, { name: 'Client Strategy Calendar' },
  { calendarType: 'personal' }, { shouldSendAlertEmailsToAssignedMember: true }, { alertEmail: 'advisor@example.com' },
  { linkedCalendar: { id: 'staffCalendar' } }, { isLivePaymentMode: true }, { enableRecurring: true },
])('blocks unsafe calendar settings %j before any POST', async patch => {
  const f = fixture(); Object.assign(f.calendar, patch)
  await expect(f.client.createContact(f.input)).rejects.toThrow('silent_test_calendar_not_isolated')
  expect(f.fetchImpl.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it.each(['email', 'sms', 'whatsapp', 'inApp'])('blocks active %s notifications', async channel => {
  const f = fixture(); f.setNotifications([{ channel, isActive: true, deleted: false }])
  await expect(f.client.createContact(f.input)).rejects.toThrow('silent_test_notifications_not_off')
})
it('blocks unknown and published workflows', async () => {
  const f = fixture(); f.setWorkflows([{ status: 'published' }])
  await expect(f.client.createContact(f.input)).rejects.toThrow('silent_test_workflows_not_safe')
  f.setWorkflows([{}]); await expect(f.client.createContact(f.input)).rejects.toThrow('silent_test_workflows_not_safe')
})
it.each([{ dnd: false }, { source: 'Real client' }, { phone: '+12025550100' }, { tags: ['client'] }, { additionalEmails: ['real@example.com'] }])('rejects contact mismatch %j', async patch => {
  const f = fixture(); Object.assign(f.contact, patch)
  await expect(f.client.createEvent(f.input, 'qaContact')).rejects.toThrow('silent_test_contact_identity_or_dnd_mismatch')
  expect(f.fetchImpl.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('blocks incomplete searches and changed appointment identities', async () => {
  const f = fixture(); f.setTotal(101)
  await expect(f.client.findContacts(f.input)).rejects.toThrow('silent_test_contact_search_incomplete')
  f.event.contactId = 'anotherContact'
  await expect(f.client.verifyEvent(f.input, 'qaContact', 'qaEvent')).rejects.toThrow('silent_test_event_mismatch')
})
it('write gate stays closed independently of read access', async () => {
  const f = fixture(false)
  await f.client.assertSilentCalendar(f.input.calendarId)
  await expect(f.client.createContact(f.input)).rejects.toThrow('silent_test_writes_disabled')
  expect(f.fetchImpl.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
})
it('never exposes token or raw network/provider errors', async () => {
  const fetchImpl = vi.fn(async () => { throw new Error('secret-value raw response') })
  const f = fixture()
  const c = new SilentTestBookingClient({ token: 'secret-value', locationId: LOCATION, calendarId: f.input.calendarId, allowTestWrites: false }, fetchImpl)
  await expect(c.assertSilentCalendar(f.input.calendarId)).rejects.toThrow(/^silent_test_network_error$/)
})
