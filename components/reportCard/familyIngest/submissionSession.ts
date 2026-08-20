/**
 * Family Report Card public ingest — browser session lifecycle.
 * Stores only non-secret client state needed for idempotent CRM submission.
 */

export const FAMILY_INGEST_SESSION_KEY = 'valtoris-family-ingest-session'
export const BUSINESS_INGEST_SESSION_KEY = 'valtoris-business-ingest-session'
export const RETIREMENT_INGEST_SESSION_KEY = 'valtoris-retirement-ingest-session'
export const PROTECTION_INGEST_SESSION_KEY = 'valtoris-protection-ingest-session'

export type FamilyUtmSnapshot = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}

export type FamilyCardAttributionSnapshot = {
  cardPublicKey: string | null
  cardSlug: string | null
  campaignCode: string | null
  eventCode: string | null
  sourceChannel: string | null
}

export type FamilyIngestSessionStatus = 'idle' | 'submitting' | 'succeeded' | 'failed'

export type FamilyIngestSession = {
  submissionId: string | null
  formStartedAt: string | null
  referrer: string | null
  utm: FamilyUtmSnapshot
  cardAttribution: FamilyCardAttributionSnapshot
  /** First-touch UTM already captured for this assessment attempt. */
  utmLocked: boolean
  status: FamilyIngestSessionStatus
}

export const EMPTY_UTM: FamilyUtmSnapshot = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
}

export const EMPTY_CARD_ATTRIBUTION: FamilyCardAttributionSnapshot = {
  cardPublicKey: null,
  cardSlug: null,
  campaignCode: null,
  eventCode: null,
  sourceChannel: null,
}

export function createEmptyFamilyIngestSession(
  nowIso: string = new Date().toISOString(),
): FamilyIngestSession {
  return {
    submissionId: null,
    formStartedAt: nowIso,
    referrer: null,
    utm: { ...EMPTY_UTM },
    cardAttribution: { ...EMPTY_CARD_ATTRIBUTION },
    utmLocked: false,
    status: 'idle',
  }
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createUuidV4(
  randomUuid: () => string = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    // RFC4122 v4 fallback for environments without crypto.randomUUID.
    const bytes = new Uint8Array(16)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  },
): string {
  const id = randomUuid()
  if (!UUID_V4_RE.test(id)) {
    throw new Error('Failed to generate a valid UUID v4 submission id')
  }
  return id
}

export function isUuidV4(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_V4_RE.test(value)
}

const MAX_UTM_LENGTH = 200

function clipQueryValue(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_UTM_LENGTH)
}

/** Reads only the allow-listed UTM params from a URL search string. */
export function readUtmFromSearch(search: string): FamilyUtmSnapshot {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  return {
    utmSource: clipQueryValue(params.get('utm_source')),
    utmMedium: clipQueryValue(params.get('utm_medium')),
    utmCampaign: clipQueryValue(params.get('utm_campaign')),
    utmTerm: clipQueryValue(params.get('utm_term')),
    utmContent: clipQueryValue(params.get('utm_content')),
  }
}

/** Opaque card public key + campaign codes. Never reads advisor UUIDs. */
export function readCardAttributionFromSearch(search: string): FamilyCardAttributionSnapshot {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  return {
    cardPublicKey: clipQueryValue(params.get('card')),
    cardSlug: clipQueryValue(params.get('card_slug')),
    campaignCode: clipQueryValue(params.get('c')),
    eventCode: clipQueryValue(params.get('e')),
    sourceChannel: clipQueryValue(params.get('src')),
  }
}

export function hasAnyCardAttribution(value: FamilyCardAttributionSnapshot): boolean {
  return Boolean(
    value.cardPublicKey ||
      value.cardSlug ||
      value.campaignCode ||
      value.eventCode ||
      value.sourceChannel,
  )
}

export function hasAnyUtm(utm: FamilyUtmSnapshot): boolean {
  return Boolean(
    utm.utmSource || utm.utmMedium || utm.utmCampaign || utm.utmTerm || utm.utmContent,
  )
}

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

export function readFamilyIngestSession(
  storageKey: string = FAMILY_INGEST_SESSION_KEY,
): FamilyIngestSession | null {
  if (!canUseSessionStorage()) return null
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FamilyIngestSession>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      submissionId: typeof parsed.submissionId === 'string' ? parsed.submissionId : null,
      formStartedAt: typeof parsed.formStartedAt === 'string' ? parsed.formStartedAt : null,
      referrer: typeof parsed.referrer === 'string' ? parsed.referrer : null,
      utm: {
        utmSource: typeof parsed.utm?.utmSource === 'string' ? parsed.utm.utmSource : null,
        utmMedium: typeof parsed.utm?.utmMedium === 'string' ? parsed.utm.utmMedium : null,
        utmCampaign: typeof parsed.utm?.utmCampaign === 'string' ? parsed.utm.utmCampaign : null,
        utmTerm: typeof parsed.utm?.utmTerm === 'string' ? parsed.utm.utmTerm : null,
        utmContent: typeof parsed.utm?.utmContent === 'string' ? parsed.utm.utmContent : null,
      },
      cardAttribution: {
        cardPublicKey:
          typeof parsed.cardAttribution?.cardPublicKey === 'string'
            ? parsed.cardAttribution.cardPublicKey
            : null,
        cardSlug:
          typeof parsed.cardAttribution?.cardSlug === 'string' ? parsed.cardAttribution.cardSlug : null,
        campaignCode:
          typeof parsed.cardAttribution?.campaignCode === 'string'
            ? parsed.cardAttribution.campaignCode
            : null,
        eventCode:
          typeof parsed.cardAttribution?.eventCode === 'string' ? parsed.cardAttribution.eventCode : null,
        sourceChannel:
          typeof parsed.cardAttribution?.sourceChannel === 'string'
            ? parsed.cardAttribution.sourceChannel
            : null,
      },
      utmLocked: Boolean(parsed.utmLocked),
      status:
        parsed.status === 'submitting' ||
        parsed.status === 'succeeded' ||
        parsed.status === 'failed' ||
        parsed.status === 'idle'
          ? parsed.status
          : 'idle',
    }
  } catch {
    return null
  }
}

export function writeFamilyIngestSession(
  session: FamilyIngestSession,
  storageKey: string = FAMILY_INGEST_SESSION_KEY,
): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(session))
  } catch {
    // Quota / private mode — submission can still proceed in-memory.
  }
}

export function clearFamilyIngestSession(storageKey: string = FAMILY_INGEST_SESSION_KEY): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

/**
 * Starts a brand-new assessment attempt.
 * Clears submission UUID and status; refreshes form start time; captures first-touch UTM once.
 */
export function beginNewFamilyAssessmentSession(input: {
  search?: string
  referrer?: string | null
  nowIso?: string
  randomUuid?: () => string
  storageKey?: string
}): FamilyIngestSession {
  const nowIso = input.nowIso ?? new Date().toISOString()
  const fromUrl = readUtmFromSearch(input.search ?? '')
  const cardFromUrl = readCardAttributionFromSearch(input.search ?? '')
  const session = createEmptyFamilyIngestSession(nowIso)
  session.referrer = clipQueryValue(input.referrer ?? null)
  if (hasAnyUtm(fromUrl) || hasAnyCardAttribution(cardFromUrl)) {
    session.utm = fromUrl
    session.cardAttribution = cardFromUrl
    session.utmLocked = true
  }
  writeFamilyIngestSession(session, input.storageKey)
  return session
}

/**
 * Ensures a session exists when entering the assessment (without wiping an in-progress attempt).
 * Recovers from a stale `submitting` status after refresh so the user can retry.
 */
export function ensureFamilyIngestSession(input: {
  search?: string
  referrer?: string | null
  nowIso?: string
  storageKey?: string
}): FamilyIngestSession {
  const existing = readFamilyIngestSession(input.storageKey)
  if (existing) {
    const recovered: FamilyIngestSession = {
      ...existing,
      cardAttribution: existing.cardAttribution ?? { ...EMPTY_CARD_ATTRIBUTION },
      // Never leave a refreshed page stuck in "submitting".
      status: existing.status === 'submitting' ? 'failed' : existing.status,
    }
    if (!recovered.utmLocked) {
      const fromUrl = readUtmFromSearch(input.search ?? '')
      const cardFromUrl = readCardAttributionFromSearch(input.search ?? '')
      if (hasAnyUtm(fromUrl) || hasAnyCardAttribution(cardFromUrl)) {
        recovered.utm = fromUrl
        recovered.cardAttribution = cardFromUrl
        recovered.utmLocked = true
      }
    }
    if (!recovered.referrer) {
      recovered.referrer = clipQueryValue(input.referrer ?? null)
    }
    if (!recovered.formStartedAt) {
      recovered.formStartedAt = input.nowIso ?? new Date().toISOString()
    }
    writeFamilyIngestSession(recovered, input.storageKey)
    return recovered
  }
  return beginNewFamilyAssessmentSession(input)
}

/**
 * Returns the stable submission UUID for this assessment attempt.
 * Generates once; retries reuse the same id. Does nothing if already succeeded
 * and a valid id exists (results navigation must not mutate it).
 */
export function ensureFamilySubmissionId(
  session: FamilyIngestSession,
  randomUuid?: () => string,
  storageKey: string = FAMILY_INGEST_SESSION_KEY,
): { session: FamilyIngestSession; submissionId: string; created: boolean } {
  if (isUuidV4(session.submissionId)) {
    return { session, submissionId: session.submissionId as string, created: false }
  }
  const submissionId = createUuidV4(randomUuid)
  const next: FamilyIngestSession = { ...session, submissionId }
  writeFamilyIngestSession(next, storageKey)
  return { session: next, submissionId, created: true }
}

export function markFamilyIngestStatus(
  session: FamilyIngestSession,
  status: FamilyIngestSessionStatus,
  storageKey: string = FAMILY_INGEST_SESSION_KEY,
): FamilyIngestSession {
  const next = { ...session, status }
  writeFamilyIngestSession(next, storageKey)
  return next
}
