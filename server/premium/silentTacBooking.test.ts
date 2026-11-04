import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest'
import { LocalTacSandbox } from './localSandbox'
import { LocalTacBookingQueue } from './localTacBookingQueue'
import { exportSilentTacBooking, type QaBooking, type SilentBookingProvider } from './silentTacBooking'
import { combinedFixture } from './testFixtures'
import { PRIORITIES, type Priority } from '../../modules/reportCard/combined/engine'

let sandbox: LocalTacSandbox, queue: LocalTacBookingQueue, dir: string
beforeAll(async () => {
  dir = await mkdtemp(tmpdir() + '/tac-export-qa-')
  sandbox = new LocalTacSandbox(dir)
  await sandbox.initialize(process.cwd())
  queue = new LocalTacBookingQueue(sandbox.db)
  await queue.initialize()
}, 30000)
afterAll(async () => { await sandbox.db.close(); await rm(dir, { recursive: true, force: true }) })
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden') })))
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals() })
const phones = new Map<string, string>()
async function input(priority: Priority = 'family', email = `${randomUUID()}@example.invalid`): Promise<QaBooking> {
  const answers = combinedFixture([priority]); answers.contact.email = email; if (!phones.has(email)) phones.set(email, '+1202555' + String(100 + phones.size).padStart(4, '0')); answers.contact.phone = phones.get(email)!
  const submission = randomUUID()
  await sandbox.persist({ idempotency_key: submission, answers, assessment_type: 'financial_priorities',
    first_name: 'Valtoris', last_name: 'QA', normalized_email: email, normalized_phone: answers.contact.phone, derived_metrics: {} })
  const row = (await sandbox.db.query<{ household_id: string }>('SELECT household_id FROM local_submissions WHERE id=$1', [submission])).rows[0]
  return { requestId: randomUUID(), submissionId: submission, contactKey: row.household_id, email,
    calendarId: 'silentQA', startTime: '2030-01-02T15:00:00Z', endTime: '2030-01-02T15:30:00Z' }
}
function provider() {
  const contacts = new Map<string, string>(), events = new Map<string, string>()
  const p: SilentBookingProvider = {
    assertSilentCalendar: vi.fn(async () => {}),
    findContacts: vi.fn(async i => contacts.has(i.email) ? [contacts.get(i.email)!] : []),
    verifyContact: vi.fn(async () => {}),
    createContact: vi.fn(async i => { const id = randomUUID(); contacts.set(i.email, id); return id }),
    findEvents: vi.fn(async i => events.has(i.requestId) ? [events.get(i.requestId)!] : []),
    verifyEvent: vi.fn(async () => {}),
    createEvent: vi.fn(async i => { const id = randomUUID(); events.set(i.requestId, id); return id }),
  }
  return { p, contacts, events }
}
it.each(PRIORITIES)('$id saves TAC first and exports exactly one contact and booking across repeated delivery', async ({ id }) => {
  const i = await input(id); await queue.save(i)
  const { p } = provider()
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ status: 'confirmed' })
  await queue.save(i)
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ status: 'confirmed' })
  expect(p.createContact).toHaveBeenCalledTimes(1); expect(p.createEvent).toHaveBeenCalledTimes(1)
})
it('refuses provider calls without a committed TAC request', async () => {
  const { p } = provider()
  expect(await exportSilentTacBooking(queue, p, randomUUID())).toEqual({ status: 'review_required', reason: 'tac_request_missing' })
  expect(p.assertSilentCalendar).not.toHaveBeenCalled()
})
it('rejects real addresses, altered requests, changed identity and duplicate submission/slot keys', async () => {
  const i = await input()
  await expect(queue.save({ ...i, email: 'person@example.com' })).rejects.toThrow('invalid_test_booking')
  await expect(queue.save({ ...i, submissionId: randomUUID() })).rejects.toThrow('tac_assessment_identity_mismatch')
  await queue.save(i)
  await expect(queue.save({ ...i, startTime: '2030-01-02T15:01:00Z' })).rejects.toThrow('tac_booking_request_conflict')
  await expect(queue.save({ ...i, requestId: randomUUID() })).rejects.toThrow()
  await expect(queue.save({ ...i, contactKey: randomUUID() })).rejects.toThrow('tac_assessment_identity_mismatch')
})
it('keeps contact and booking creation unique under concurrent workers', async () => {
  const i = await input(); await queue.save(i); const { p } = provider()
  await Promise.all(Array.from({ length: 8 }, () => exportSilentTacBooking(queue, p, i.requestId)))
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ status: 'confirmed' })
  expect(p.createContact).toHaveBeenCalledTimes(1); expect(p.createEvent).toHaveBeenCalledTimes(1)
})
it('holds an uncertain contact POST and reconciles a later provider read without another POST', async () => {
  const i = await input(); await queue.save(i); const { p, contacts } = provider()
  vi.mocked(p.createContact).mockImplementationOnce(async () => { contacts.set(i.email, 'acceptedContact'); throw new Error('timeout') })
  await expect(exportSilentTacBooking(queue, p, i.requestId)).rejects.toThrow('timeout')
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ status: 'confirmed', contactId: 'acceptedContact' })
  expect(p.createContact).toHaveBeenCalledTimes(1)
})
it('never retries an uncertain POST when reconciliation finds nothing, including after reopening TAC', async () => {
  const i = await input(); await queue.save(i); const { p } = provider()
  vi.mocked(p.createContact).mockRejectedValueOnce(new Error('timeout'))
  await expect(exportSilentTacBooking(queue, p, i.requestId)).rejects.toThrow('timeout')
  await sandbox.db.close(); sandbox = new LocalTacSandbox(dir); await sandbox.initialize(process.cwd())
  queue = new LocalTacBookingQueue(sandbox.db); await queue.initialize()
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ reason: 'contact_create_uncertain_or_busy' })
  expect(p.createContact).toHaveBeenCalledTimes(1); expect(p.createEvent).not.toHaveBeenCalled()
})
it('reconciles an accepted event after a timeout instead of creating a duplicate', async () => {
  const i = await input(); await queue.save(i); const { p, events } = provider()
  vi.mocked(p.createEvent).mockImplementationOnce(async () => { events.set(i.requestId, 'acceptedEvent'); throw new Error('timeout') })
  await expect(exportSilentTacBooking(queue, p, i.requestId)).rejects.toThrow('timeout')
  await expect(exportSilentTacBooking(queue, p, i.requestId)).resolves.toMatchObject({ eventId: 'acceptedEvent' })
  expect(p.createEvent).toHaveBeenCalledTimes(1)
})
it('blocks existing duplicates and unsafe calendar changes without another event POST', async () => {
  const i = await input(); await queue.save(i); const { p } = provider()
  vi.mocked(p.findContacts).mockResolvedValueOnce(['one', 'two'])
  expect(await exportSilentTacBooking(queue, p, i.requestId)).toMatchObject({ reason: 'duplicate_contacts' })
  expect(p.createContact).not.toHaveBeenCalled()
  vi.mocked(p.assertSilentCalendar).mockResolvedValueOnce().mockRejectedValueOnce(new Error('notifications_changed'))
  await expect(exportSilentTacBooking(queue, p, i.requestId)).rejects.toThrow('notifications_changed')
  expect(p.createEvent).not.toHaveBeenCalled()
})
it('uses one existing test contact for multiple assessments, and blocks the same contact/slot twice', async () => {
  const i = await input(); await queue.save(i); const { p } = provider()
  await exportSilentTacBooking(queue, p, i.requestId)
  const second = await input('tsp', i.email)
  await expect(queue.save(second)).rejects.toThrow()
  second.startTime = '2030-01-02T16:00:00Z'; second.endTime = '2030-01-02T16:30:00Z'
  await queue.save(second)
  await expect(exportSilentTacBooking(queue, p, second.requestId)).resolves.toMatchObject({ status: 'confirmed' })
  expect(p.createContact).toHaveBeenCalledTimes(1); expect(p.createEvent).toHaveBeenCalledTimes(2)
})
