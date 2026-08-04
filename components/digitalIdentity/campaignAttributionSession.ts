/**
 * Browser first-touch / last-touch attribution for public Digital Identity cards.
 * Session-scoped only — never writes CRM rows from views alone.
 */

import {
  parseCampaignAttributionFromSearch,
  type NormalizedCampaignAttribution,
} from '../../modules/digital-identity/campaignUrls'

const STORAGE_PREFIX = 'di_attrib_v1:'

export type CardAttributionSession = {
  firstTouch: NormalizedCampaignAttribution & { firstSeenAt: string }
  lastTouch: NormalizedCampaignAttribution & { occurredAt: string }
}

function storageKey(publicKey: string): string {
  return `${STORAGE_PREFIX}${publicKey}`
}

function readSession(publicKey: string): CardAttributionSession | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(publicKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CardAttributionSession
    if (!parsed?.firstTouch || !parsed?.lastTouch) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(publicKey: string, value: CardAttributionSession): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(publicKey), JSON.stringify(value))
  } catch {
    // Ignore quota / private mode failures.
  }
}

/**
 * Capture attribution from the current URL into sessionStorage.
 * First-touch is locked; last-touch refreshes on each arrival with params.
 */
export function captureCardAttributionFromLocation(
  publicKey: string,
  search: string,
  nowIso: string = new Date().toISOString(),
): CardAttributionSession {
  const incoming = parseCampaignAttributionFromSearch(search)
  const existing = readSession(publicKey)
  const hasIncoming = Boolean(
    incoming.campaignCode ||
      incoming.eventCode ||
      incoming.sourceChannel ||
      incoming.utmSource ||
      incoming.utmMedium ||
      incoming.utmCampaign ||
      incoming.utmTerm ||
      incoming.utmContent,
  )

  if (!existing) {
    const seed = {
      ...incoming,
      firstSeenAt: nowIso,
      occurredAt: nowIso,
    }
    const created: CardAttributionSession = {
      firstTouch: {
        campaignCode: incoming.campaignCode,
        eventCode: incoming.eventCode,
        sourceChannel: incoming.sourceChannel,
        utmSource: incoming.utmSource,
        utmMedium: incoming.utmMedium,
        utmCampaign: incoming.utmCampaign,
        utmTerm: incoming.utmTerm,
        utmContent: incoming.utmContent,
        firstSeenAt: nowIso,
      },
      lastTouch: {
        campaignCode: incoming.campaignCode,
        eventCode: incoming.eventCode,
        sourceChannel: incoming.sourceChannel,
        utmSource: incoming.utmSource,
        utmMedium: incoming.utmMedium,
        utmCampaign: incoming.utmCampaign,
        utmTerm: incoming.utmTerm,
        utmContent: incoming.utmContent,
        occurredAt: nowIso,
      },
    }
    void seed
    writeSession(publicKey, created)
    return created
  }

  if (hasIncoming) {
    existing.lastTouch = {
      campaignCode: incoming.campaignCode,
      eventCode: incoming.eventCode,
      sourceChannel: incoming.sourceChannel,
      utmSource: incoming.utmSource,
      utmMedium: incoming.utmMedium,
      utmCampaign: incoming.utmCampaign,
      utmTerm: incoming.utmTerm,
      utmContent: incoming.utmContent,
      occurredAt: nowIso,
    }
    writeSession(publicKey, existing)
  }

  return existing
}

export function getCardAttributionSession(publicKey: string): CardAttributionSession | null {
  return readSession(publicKey)
}

/** Friendly contextual line when a first-touch campaign label is known later via server. */
export function formatPublicCampaignContext(label: string | null | undefined): string | null {
  if (!label || typeof label !== 'string') return null
  const trimmed = label.trim()
  if (!trimmed) return null
  return `You met us at ${trimmed}.`
}
