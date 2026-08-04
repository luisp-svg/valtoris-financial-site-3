/**
 * SERVER ONLY — resolve campaign codes against the published card.
 * Unknown / disabled / deleted / cross-card codes are not trusted.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractReferrerHost,
  normalizeCampaignAttributionQuery,
  type NormalizedCampaignAttribution,
} from '../../../modules/digital-identity/campaignUrls.js'
import type { IdentitySourceChannel } from '../../../modules/digital-identity/index.js'

export type TrustedCampaignRow = {
  id: string
  digitalCardId: string
  campaignCode: string
  eventCode: string | null
  label: string
  status: 'active' | 'disabled'
  defaultUtms: Record<string, unknown>
  sourceChannelDefault: IdentitySourceChannel
}

export type TrustedAttributionResult = {
  trusted: boolean
  campaignCode: string | null
  eventCode: string | null
  campaignLabel: string | null
  sourceChannel: IdentitySourceChannel | null
  firstTouchMetadata: Record<string, unknown>
  lastTouchMetadata: Record<string, unknown>
}

function readUtmString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200)
  }
  return null
}

function mergeUtms(
  defaults: Record<string, unknown>,
  client: NormalizedCampaignAttribution,
): Record<string, string | null> {
  return {
    utmSource: client.utmSource ?? readUtmString(defaults, 'utmSource', 'utm_source'),
    utmMedium: client.utmMedium ?? readUtmString(defaults, 'utmMedium', 'utm_medium'),
    utmCampaign: client.utmCampaign ?? readUtmString(defaults, 'utmCampaign', 'utm_campaign'),
    utmTerm: client.utmTerm ?? readUtmString(defaults, 'utmTerm', 'utm_term'),
    utmContent: client.utmContent ?? readUtmString(defaults, 'utmContent', 'utm_content'),
  }
}

function buildAllowlistedTouch(input: {
  cardPublicKey: string
  campaignCode: string | null
  eventCode: string | null
  sourceChannel: IdentitySourceChannel | null
  utms: Record<string, string | null>
  referrerHost: string | null
  occurredAt: string
}): Record<string, unknown> {
  return {
    cardPublicKey: input.cardPublicKey,
    campaignCode: input.campaignCode,
    eventCode: input.eventCode,
    sourceChannel: input.sourceChannel,
    utms: input.utms,
    referrer: input.referrerHost,
    occurredAt: input.occurredAt,
  }
}

/**
 * Resolve campaign ownership + active status for a published card.
 * Returns trusted=false (and null codes) when resolution fails — never throws.
 */
export async function resolveTrustedCampaignAttribution(
  admin: SupabaseClient,
  input: {
    digitalCardId: string
    cardPublicKey: string
    campaignCode?: string | null
    eventCode?: string | null
    sourceChannel?: string | null
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    utmTerm?: string | null
    utmContent?: string | null
    referrer?: string | null
    occurredAt?: string
  },
): Promise<TrustedAttributionResult> {
  const occurredAt = input.occurredAt || new Date().toISOString()
  const client = normalizeCampaignAttributionQuery({
    campaignCode: input.campaignCode,
    eventCode: input.eventCode,
    sourceChannel: input.sourceChannel,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
  })
  const referrerHost = extractReferrerHost(input.referrer)

  const emptyTouch = buildAllowlistedTouch({
    cardPublicKey: input.cardPublicKey,
    campaignCode: null,
    eventCode: null,
    sourceChannel: client.sourceChannel,
    utms: mergeUtms({}, client),
    referrerHost,
    occurredAt,
  })
  const emptyFirst = { ...emptyTouch, firstSeenAt: occurredAt }

  if (!client.campaignCode) {
    return {
      trusted: false,
      campaignCode: null,
      eventCode: null,
      campaignLabel: null,
      sourceChannel: client.sourceChannel,
      firstTouchMetadata: emptyFirst,
      lastTouchMetadata: emptyTouch,
    }
  }

  const { data, error } = await admin
    .from('digital_card_campaigns')
    .select(
      'id, digital_card_id, campaign_code, event_code, label, status, default_utms, source_channel_default',
    )
    .eq('digital_card_id', input.digitalCardId)
    .eq('campaign_code', client.campaignCode)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data || data.status !== 'active') {
    return {
      trusted: false,
      campaignCode: null,
      eventCode: null,
      campaignLabel: null,
      sourceChannel: client.sourceChannel,
      firstTouchMetadata: emptyFirst,
      lastTouchMetadata: emptyTouch,
    }
  }

  const rowEvent = typeof data.event_code === 'string' ? data.event_code : null
  if (client.eventCode && rowEvent && client.eventCode !== rowEvent) {
    return {
      trusted: false,
      campaignCode: null,
      eventCode: null,
      campaignLabel: null,
      sourceChannel: client.sourceChannel,
      firstTouchMetadata: emptyFirst,
      lastTouchMetadata: emptyTouch,
    }
  }
  // Client supplied event code but campaign has none → untrusted.
  if (client.eventCode && !rowEvent) {
    return {
      trusted: false,
      campaignCode: null,
      eventCode: null,
      campaignLabel: null,
      sourceChannel: client.sourceChannel,
      firstTouchMetadata: emptyFirst,
      lastTouchMetadata: emptyTouch,
    }
  }

  const defaults =
    data.default_utms && typeof data.default_utms === 'object' && !Array.isArray(data.default_utms)
      ? (data.default_utms as Record<string, unknown>)
      : {}
  const sourceChannel =
    client.sourceChannel ||
    (typeof data.source_channel_default === 'string'
      ? (data.source_channel_default as IdentitySourceChannel)
      : null)
  const eventCode = client.eventCode || rowEvent
  const utms = mergeUtms(defaults, client)
  const touch = buildAllowlistedTouch({
    cardPublicKey: input.cardPublicKey,
    campaignCode: data.campaign_code,
    eventCode,
    sourceChannel,
    utms,
    referrerHost,
    occurredAt,
  })

  return {
    trusted: true,
    campaignCode: data.campaign_code,
    eventCode,
    campaignLabel: typeof data.label === 'string' ? data.label : null,
    sourceChannel,
    firstTouchMetadata: {
      ...touch,
      firstSeenAt: occurredAt,
      campaignLabel: typeof data.label === 'string' ? data.label : null,
    },
    lastTouchMetadata: touch,
  }
}
