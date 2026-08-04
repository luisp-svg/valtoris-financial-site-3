/**
 * CRM Digital Identity campaign management via authenticated Supabase (RLS authority).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildCampaignLink,
  buildEventLink,
  buildPublicCardPathWithAttribution,
  normalizeCampaignAttributionQuery,
} from '../../modules/digital-identity'
import { validateCampaignLifecycle } from './campaignEditContract'

export type CrmCampaignRow = {
  id: string
  digitalCardId: string
  cardPublicKey: string
  cardSlug: string
  advisorProfileId: string
  advisorDisplayName: string | null
  campaignCode: string
  eventCode: string | null
  label: string
  description: string | null
  status: 'active' | 'disabled'
  sourceChannelDefault: string
  defaultUtms: Record<string, unknown>
  startsAt: string | null
  endsAt: string | null
  locationLabel: string | null
  organizer: string | null
  advisorNotes: string | null
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Create-time input (codes allowed only at create). */
export type CampaignWriteInput = {
  digitalCardId: string
  campaignCode: string
  eventCode?: string | null
  label: string
  description?: string | null
  status?: 'active' | 'disabled'
  sourceChannelDefault?: string
  defaultUtms?: Record<string, unknown>
  startsAt?: string | null
  endsAt?: string | null
  locationLabel?: string | null
  organizer?: string | null
  advisorNotes?: string | null
}

/**
 * Post-create update contract — immutable identifiers intentionally omitted:
 * campaignCode, eventCode, digitalCardId, createdByUserId, id.
 */
export type CampaignUpdateInput = {
  label?: string
  description?: string | null
  status?: 'active' | 'disabled'
  sourceChannelDefault?: string
  defaultUtms?: Record<string, unknown>
  startsAt?: string | null
  endsAt?: string | null
  locationLabel?: string | null
  organizer?: string | null
  advisorNotes?: string | null
}

const CODE_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

const FORBIDDEN_UPDATE_KEYS = [
  'id',
  'campaignCode',
  'campaign_code',
  'eventCode',
  'event_code',
  'digitalCardId',
  'digital_card_id',
  'createdByUserId',
  'created_by_user_id',
] as const

function validateCodes(campaignCode: string, eventCode?: string | null): string | null {
  if (!CODE_RE.test(campaignCode)) return 'Campaign code format is invalid.'
  if (eventCode && !CODE_RE.test(eventCode)) return 'Event code format is invalid.'
  return null
}

function mapRow(row: Record<string, unknown>, card: Record<string, unknown>): CrmCampaignRow {
  const advisor = Array.isArray(card.advisor_profiles)
    ? card.advisor_profiles[0]
    : card.advisor_profiles
  const advisorRec = (advisor && typeof advisor === 'object' ? advisor : {}) as Record<
    string,
    unknown
  >
  return {
    id: String(row.id),
    digitalCardId: String(row.digital_card_id),
    cardPublicKey: String(card.public_key || ''),
    cardSlug: String(card.slug || ''),
    advisorProfileId: String(card.advisor_profile_id || ''),
    advisorDisplayName:
      typeof advisorRec.display_name === 'string' ? advisorRec.display_name : null,
    campaignCode: String(row.campaign_code),
    eventCode: typeof row.event_code === 'string' ? row.event_code : null,
    label: String(row.label),
    description: typeof row.description === 'string' ? row.description : null,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    sourceChannelDefault: String(row.source_channel_default || 'link'),
    defaultUtms:
      row.default_utms && typeof row.default_utms === 'object'
        ? (row.default_utms as Record<string, unknown>)
        : {},
    startsAt: typeof row.starts_at === 'string' ? row.starts_at : null,
    endsAt: typeof row.ends_at === 'string' ? row.ends_at : null,
    locationLabel: typeof row.location_label === 'string' ? row.location_label : null,
    organizer: typeof row.organizer === 'string' ? row.organizer : null,
    advisorNotes: typeof row.advisor_notes === 'string' ? row.advisor_notes : null,
    createdByUserId: typeof row.created_by_user_id === 'string' ? row.created_by_user_id : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  }
}

/**
 * Build the DB update object from a typed patch.
 * Strips any accidental immutable identifier keys (application-layer defense).
 */
export function buildCampaignUpdatePayload(
  patch: CampaignUpdateInput & Record<string, unknown>,
): { ok: true; update: Record<string, unknown> } | { ok: false; message: string } {
  for (const key of FORBIDDEN_UPDATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      return {
        ok: false,
        message: 'Campaign and event codes (and other identifiers) cannot be changed after creation.',
      }
    }
  }

  const update: Record<string, unknown> = {}
  if (patch.label != null) {
    const label = patch.label.trim().slice(0, 160)
    if (!label) return { ok: false, message: 'Label is required.' }
    update.label = label
  }
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.status) update.status = patch.status
  if (patch.sourceChannelDefault) update.source_channel_default = patch.sourceChannelDefault
  if (patch.defaultUtms) update.default_utms = patch.defaultUtms
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt
  if (patch.locationLabel !== undefined) {
    update.location_label = patch.locationLabel?.trim() || null
  }
  if (patch.organizer !== undefined) update.organizer = patch.organizer?.trim() || null
  if (patch.advisorNotes !== undefined) update.advisor_notes = patch.advisorNotes?.trim() || null

  const lifecycleError = validateCampaignLifecycle(
    typeof update.starts_at === 'string' ? update.starts_at : null,
    typeof update.ends_at === 'string' ? update.ends_at : null,
  )
  if (lifecycleError) return { ok: false, message: lifecycleError }

  if (Object.keys(update).length === 0) {
    return { ok: false, message: 'No changes to save.' }
  }

  // Defense: never allow these columns even if callers mutate `update` later.
  delete update.id
  delete update.campaign_code
  delete update.event_code
  delete update.digital_card_id
  delete update.created_by_user_id

  return { ok: true, update }
}

export async function listCrmCampaigns(
  supabase: SupabaseClient,
  options: { includeDeleted?: boolean } = {},
): Promise<{ ok: true; campaigns: CrmCampaignRow[] } | { ok: false; message: string }> {
  let query = supabase
    .from('digital_card_campaigns')
    .select(
      `
      id, digital_card_id, campaign_code, event_code, label, description, status,
      source_channel_default, default_utms, starts_at, ends_at, location_label, organizer,
      advisor_notes, created_by_user_id, created_at, updated_at, deleted_at,
      digital_cards!inner (
        id, public_key, slug, advisor_profile_id, deleted_at,
        advisor_profiles ( display_name )
      )
    `,
    )
    .order('created_at', { ascending: false })

  if (!options.includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query
  if (error) return { ok: false, message: 'Unable to load campaigns.' }

  const campaigns = (data || []).map((row) => {
    const card = Array.isArray(row.digital_cards) ? row.digital_cards[0] : row.digital_cards
    return mapRow(row as Record<string, unknown>, (card || {}) as Record<string, unknown>)
  })
  return { ok: true, campaigns }
}

export async function listPublishedCardsForCampaigns(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; cards: Array<{ id: string; publicKey: string; slug: string; label: string }> }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select('id, public_key, slug, status, advisor_profiles(display_name)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('slug')
  if (error) return { ok: false, message: 'Unable to load cards.' }
  return {
    ok: true,
    cards: (data || []).map((row) => {
      const advisor = Array.isArray(row.advisor_profiles)
        ? row.advisor_profiles[0]
        : row.advisor_profiles
      const name =
        advisor && typeof advisor === 'object' && typeof advisor.display_name === 'string'
          ? advisor.display_name
          : row.slug
      return {
        id: row.id,
        publicKey: row.public_key,
        slug: row.slug,
        label: `${name} (${row.slug})`,
      }
    }),
  }
}

export async function createCrmCampaign(
  supabase: SupabaseClient,
  input: CampaignWriteInput,
  userId: string,
): Promise<{ ok: true; campaignId: string } | { ok: false; message: string }> {
  const codeErr = validateCodes(input.campaignCode, input.eventCode)
  if (codeErr) return { ok: false, message: codeErr }
  if (!input.label.trim()) return { ok: false, message: 'Label is required.' }

  const lifecycleError = validateCampaignLifecycle(input.startsAt, input.endsAt)
  if (lifecycleError) return { ok: false, message: lifecycleError }

  const { data, error } = await supabase
    .from('digital_card_campaigns')
    .insert({
      digital_card_id: input.digitalCardId,
      campaign_code: input.campaignCode.trim(),
      event_code: input.eventCode?.trim() || null,
      label: input.label.trim().slice(0, 160),
      description: input.description?.trim() || null,
      status: input.status === 'disabled' ? 'disabled' : 'active',
      source_channel_default: input.sourceChannelDefault || 'link',
      default_utms: input.defaultUtms || {},
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      location_label: input.locationLabel?.trim() || null,
      organizer: input.organizer?.trim() || null,
      advisor_notes: input.advisorNotes?.trim() || null,
      created_by_user_id: userId,
    })
    .select('id')
    .single()

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, message: 'That campaign code already exists for this card.' }
    }
    if (/lifecycle_ends_after_starts|check/i.test(error.message)) {
      return { ok: false, message: 'End date must be on or after the start date.' }
    }
    return { ok: false, message: 'Unable to create campaign.' }
  }
  return { ok: true, campaignId: data.id }
}

export async function updateCrmCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  patch: CampaignUpdateInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const built = buildCampaignUpdatePayload(patch as CampaignUpdateInput & Record<string, unknown>)
  if (!built.ok) return built

  const { error } = await supabase
    .from('digital_card_campaigns')
    .update(built.update)
    .eq('id', campaignId)
    .is('deleted_at', null)

  if (error) {
    if (/lifecycle_ends_after_starts|check/i.test(error.message)) {
      return { ok: false, message: 'End date must be on or after the start date.' }
    }
    return { ok: false, message: 'Unable to update campaign.' }
  }
  return { ok: true }
}

export async function softDeleteCrmCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('digital_card_campaigns')
    .update({ deleted_at: new Date().toISOString(), status: 'disabled' })
    .eq('id', campaignId)
    .is('deleted_at', null)
  if (error) return { ok: false, message: 'Unable to archive campaign.' }
  return { ok: true }
}

export function buildCampaignPublicLink(campaign: CrmCampaignRow): string {
  if (campaign.eventCode) {
    return buildEventLink(campaign.cardPublicKey, campaign.campaignCode, campaign.eventCode, {
      sourceChannel: 'link',
    })
  }
  return buildCampaignLink(campaign.cardPublicKey, campaign.campaignCode, {
    sourceChannel: 'link',
  })
}

export function buildCampaignPreviewDestination(campaign: CrmCampaignRow): string {
  const utms = normalizeCampaignAttributionQuery({
    utmSource:
      typeof campaign.defaultUtms.utmSource === 'string' ? campaign.defaultUtms.utmSource : null,
    utmMedium:
      typeof campaign.defaultUtms.utmMedium === 'string' ? campaign.defaultUtms.utmMedium : null,
    utmCampaign:
      typeof campaign.defaultUtms.utmCampaign === 'string'
        ? campaign.defaultUtms.utmCampaign
        : null,
  })
  return buildPublicCardPathWithAttribution(campaign.cardPublicKey, {
    campaignCode: campaign.campaignCode,
    eventCode: campaign.eventCode,
    sourceChannel: 'link',
    utmSource: utms.utmSource,
    utmMedium: utms.utmMedium,
    utmCampaign: utms.utmCampaign,
  })
}
