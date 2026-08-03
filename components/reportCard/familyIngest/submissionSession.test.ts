import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  beginNewFamilyAssessmentSession,
  clearFamilyIngestSession,
  createUuidV4,
  ensureFamilyIngestSession,
  ensureFamilySubmissionId,
  FAMILY_INGEST_SESSION_KEY,
  markFamilyIngestStatus,
  readFamilyIngestSession,
  readUtmFromSearch,
} from './submissionSession'

function installMemorySessionStorage() {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: memoryStorage,
  })
}

describe('createUuidV4', () => {
  it('returns a UUID v4 from crypto.randomUUID when available', () => {
    const id = createUuidV4(() => 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
    expect(id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
  })

  it('rejects non-v4 values from the generator', () => {
    expect(() => createUuidV4(() => 'not-a-uuid')).toThrow(/valid UUID v4/)
  })
})

describe('readUtmFromSearch', () => {
  it('captures allow-listed UTM params and ignores others', () => {
    const utm = readUtmFromSearch(
      '?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_term=life&utm_content=ad1&fbclid=drop-me',
    )
    expect(utm).toEqual({
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'spring',
      utmTerm: 'life',
      utmContent: 'ad1',
    })
  })

  it('clips oversized UTM values', () => {
    const long = 'x'.repeat(250)
    expect(readUtmFromSearch(`?utm_source=${long}`).utmSource?.length).toBe(200)
  })
})

describe('family ingest session lifecycle', () => {
  beforeEach(() => {
    installMemorySessionStorage()
    clearFamilyIngestSession()
  })

  afterEach(() => {
    clearFamilyIngestSession()
  })

  it('creates a first submission UUID and reuses it on retry', () => {
    const session = beginNewFamilyAssessmentSession({
      search: '?utm_source=newsletter',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(session.submissionId).toBeNull()

    const first = ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(first.created).toBe(true)
    expect(first.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')

    const retry = ensureFamilySubmissionId(first.session, () => 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(retry.created).toBe(false)
    expect(retry.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('issues a new UUID when beginning a new assessment', () => {
    let session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    session = ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee').session
    expect(session.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')

    const next = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T21:00:00.000Z' })
    expect(next.submissionId).toBeNull()
    const regenerated = ensureFamilySubmissionId(next, () => 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(regenerated.submissionId).toBe('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('does not create two IDs for consecutive ensure calls (double-click)', () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const a = ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    const b = ensureFamilySubmissionId(a.session, () => 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(a.submissionId).toBe(b.submissionId)
  })

  it('preserves first-touch UTM and does not overwrite later search params', () => {
    const first = beginNewFamilyAssessmentSession({
      search: '?utm_source=first',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(first.utm.utmSource).toBe('first')
    expect(first.utmLocked).toBe(true)

    const ensured = ensureFamilyIngestSession({
      search: '?utm_source=second',
      nowIso: '2026-07-28T20:05:00.000Z',
    })
    expect(ensured.utm.utmSource).toBe('first')
  })

  it('recovers a stale submitting status after refresh so retry is possible', () => {
    let session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    session = ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee').session
    markFamilyIngestStatus(session, 'submitting')
    expect(readFamilyIngestSession()?.status).toBe('submitting')

    const recovered = ensureFamilyIngestSession({ nowIso: '2026-07-28T20:10:00.000Z' })
    expect(recovered.status).toBe('failed')
    expect(recovered.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('does not mutate submission ID when marking succeeded (results navigation)', () => {
    let session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    session = ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee').session
    session = markFamilyIngestStatus(session, 'succeeded')
    expect(session.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(sessionStorage.getItem(FAMILY_INGEST_SESSION_KEY)).toContain(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    )
  })
})
