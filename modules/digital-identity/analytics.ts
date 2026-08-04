/**
 * Anonymous analytics contracts — pure validation only.
 * Never household Activities. Never contact PII.
 */

import { DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS } from './constants'
import { isValidIdentityPublicKey } from './slug'
import type {
  IdentityAnonymousEvent,
  IdentityAnonymousEventKey,
  IdentitySourceChannel,
  IdentityUtmAttribution,
} from './types'

const SOURCE_CHANNELS: readonly IdentitySourceChannel[] = [
  'link',
  'qr',
  'nfc',
  'share',
  'unknown',
]

const PII_METADATA_KEYS = [
  'email',
  'phone',
  'firstName',
  'lastName',
  'fullName',
  'name',
  'note',
  'notes',
  'company',
  'householdId',
  'leadId',
  'advisorId',
  'advisorProfileId',
] as const

export function isIdentityAnonymousEventKey(value: string): value is IdentityAnonymousEventKey {
  return (DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS as readonly string[]).includes(value)
}

export function emptyUtmAttribution(): IdentityUtmAttribution {
  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
  }
}

function readOptionalUtm(value: unknown, max = 128): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export function normalizeUtmAttribution(input: unknown): IdentityUtmAttribution {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return emptyUtmAttribution()
  }
  const record = input as Record<string, unknown>
  return {
    utmSource: readOptionalUtm(record.utmSource ?? record.utm_source),
    utmMedium: readOptionalUtm(record.utmMedium ?? record.utm_medium),
    utmCampaign: readOptionalUtm(record.utmCampaign ?? record.utm_campaign),
    utmContent: readOptionalUtm(record.utmContent ?? record.utm_content),
    utmTerm: readOptionalUtm(record.utmTerm ?? record.utm_term),
  }
}

export function sanitizeAnonymousSafeMetadata(
  input: unknown,
): Readonly<Record<string, string | number | boolean | null>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const record = input as Record<string, unknown>
  const out: Record<string, string | number | boolean | null> = {}

  for (const [key, value] of Object.entries(record)) {
    if ((PII_METADATA_KEYS as readonly string[]).includes(key)) continue
    if (key.length > 64) continue
    if (typeof value === 'string') {
      out[key] = value.trim().slice(0, 256)
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
    } else if (typeof value === 'boolean') {
      out[key] = value
    } else if (value === null) {
      out[key] = null
    }
  }
  return out
}

export type AnonymousEventValidation =
  | { ok: true; event: IdentityAnonymousEvent }
  | { ok: false; reason: string }

/**
 * Validates an anonymous analytics event draft.
 * Rejects PII metadata keys and missing surface public key.
 */
export function validateAnonymousEventDraft(input: unknown): AnonymousEventValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'invalid_payload' }
  }
  const record = input as Record<string, unknown>

  const eventKeyRaw = typeof record.eventKey === 'string' ? record.eventKey : ''
  if (!isIdentityAnonymousEventKey(eventKeyRaw)) {
    return { ok: false, reason: 'unknown_event_key' }
  }

  const anonymousSessionId =
    typeof record.anonymousSessionId === 'string' ? record.anonymousSessionId.trim() : ''
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(anonymousSessionId)) {
    return { ok: false, reason: 'invalid_session_id' }
  }

  const surfacePublicKey =
    typeof record.surfacePublicKey === 'string' ? record.surfacePublicKey.trim() : ''
  if (!isValidIdentityPublicKey(surfacePublicKey)) {
    return { ok: false, reason: 'invalid_surface_public_key' }
  }

  const sourceChannelRaw =
    typeof record.sourceChannel === 'string' ? record.sourceChannel : 'unknown'
  const sourceChannel = (SOURCE_CHANNELS as readonly string[]).includes(sourceChannelRaw)
    ? (sourceChannelRaw as IdentitySourceChannel)
    : 'unknown'

  const campaignCode =
    typeof record.campaignCode === 'string' && record.campaignCode.trim()
      ? record.campaignCode.trim().slice(0, 64)
      : null
  const eventCode =
    typeof record.eventCode === 'string' && record.eventCode.trim()
      ? record.eventCode.trim().slice(0, 64)
      : null

  const occurredAt =
    typeof record.occurredAt === 'string' && record.occurredAt.trim()
      ? record.occurredAt.trim()
      : new Date().toISOString()

  if (record.safeMetadata && typeof record.safeMetadata === 'object' && !Array.isArray(record.safeMetadata)) {
    for (const key of Object.keys(record.safeMetadata as object)) {
      if ((PII_METADATA_KEYS as readonly string[]).includes(key)) {
        return { ok: false, reason: 'pii_metadata_forbidden' }
      }
    }
  }

  const safeMetadata = sanitizeAnonymousSafeMetadata(record.safeMetadata)

  return {
    ok: true,
    event: {
      eventKey: eventKeyRaw,
      anonymousSessionId,
      surfacePublicKey,
      campaignCode,
      eventCode,
      sourceChannel,
      utm: normalizeUtmAttribution(record.utm),
      occurredAt,
      safeMetadata,
    },
  }
}

/** Views / downloads / clicks never create CRM leads or households. */
export function anonymousEventCreatesCrmRecord(_eventKey: IdentityAnonymousEventKey): false {
  return false
}
