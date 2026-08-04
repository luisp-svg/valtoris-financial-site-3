/**
 * Sprint 5.9 campaign edit contract — mutable vs immutable identifiers.
 * campaignCode / eventCode are immutable after creation (links/QR may already be distributed).
 */

import type { PublicCardQrFormat } from '../../modules/digital-identity'
import type { CrmCampaignRow } from './campaignsApi'

/** Fields the post-create edit UI must expose. */
export const CAMPAIGN_EDITABLE_FIELD_KEYS = [
  'label',
  'description',
  'locationLabel',
  'organizer',
  'advisorNotes',
  'startsAt',
  'endsAt',
] as const

export type CampaignEditableFieldKey = (typeof CAMPAIGN_EDITABLE_FIELD_KEYS)[number]

/** Identifiers that must never be mutated after create (application-layer). */
export const CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS = [
  'id',
  'digitalCardId',
  'campaignCode',
  'eventCode',
  'createdByUserId',
] as const

export const CAMPAIGN_QR_FORMATS: readonly {
  format: PublicCardQrFormat
  label: string
}[] = [
  { format: 'svg', label: 'SVG' },
  { format: 'png', label: 'PNG' },
  { format: 'png-hires', label: 'Print PNG' },
]

export const CAMPAIGN_CODES_IMMUTABLE_COPY =
  'Campaign and event codes cannot be changed after creation because they may already appear in shared links, QR codes, or printed materials.'

export type CampaignEditFormState = {
  label: string
  description: string
  locationLabel: string
  organizer: string
  advisorNotes: string
  startsAt: string
  endsAt: string
}

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function campaignEditFormFromRow(campaign: CrmCampaignRow): CampaignEditFormState {
  return {
    label: campaign.label,
    description: campaign.description || '',
    locationLabel: campaign.locationLabel || '',
    organizer: campaign.organizer || '',
    advisorNotes: campaign.advisorNotes || '',
    startsAt: toDatetimeLocalValue(campaign.startsAt),
    endsAt: toDatetimeLocalValue(campaign.endsAt),
  }
}

/** Client-side lifecycle check mirroring DB ends_at >= starts_at when both set. */
export function validateCampaignLifecycle(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string | null {
  if (!startsAt || !endsAt) return null
  const startMs = Date.parse(startsAt)
  const endMs = Date.parse(endsAt)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  if (endMs < startMs) return 'End date must be on or after the start date.'
  return null
}

export function buildCampaignQrQuery(input: {
  publicKey: string
  campaignCode: string
  eventCode?: string | null
  format: PublicCardQrFormat
}): URLSearchParams {
  const params = new URLSearchParams({
    key: input.publicKey,
    format: input.format,
    c: input.campaignCode,
  })
  if (input.eventCode) params.set('e', input.eventCode)
  return params
}

export function assertCampaignQrDestinationSafe(destinationUrl: string | null | undefined): {
  ok: boolean
  reason?: string
} {
  if (!destinationUrl) return { ok: false, reason: 'missing_destination' }
  if (destinationUrl.includes('/c/') && !destinationUrl.includes('/c/k/')) {
    return { ok: false, reason: 'slug_destination' }
  }
  try {
    const path =
      destinationUrl.startsWith('/')
        ? destinationUrl.split(/[?#]/)[0]
        : new URL(destinationUrl).pathname
    if (!/^\/c\/k\/[^/]+$/.test(path || '')) {
      return { ok: false, reason: 'not_public_key_path' }
    }
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  return { ok: true }
}
