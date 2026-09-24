import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'
import { isQuoteKind, isQuoteLead } from '../../../modules/insuranceQuote/catalog.js'
import { createIntegrationContactLinkRepository, type IntegrationContactLinkAdmin } from '../contactLinks.js'
import { quoteSyncEnabled, QUOTE_LOCATION } from './config.js'
import { quoteTransport } from './transport.js'
import { deliverQuote, DeliveryHold, record, type Delivery } from './deliver.js'

export async function syncQuoteDelivery(leadId?: string, deps: { admin?: SupabaseClient; env?: NodeJS.ProcessEnv } = {}): Promise<string> {
  const env = deps.env ?? process.env
  if (!quoteSyncEnabled(env)) return 'disabled'
  const admin = deps.admin ?? createSupabaseAdminClient()
  const { data, error } = await admin.rpc('claim_insurance_quote_delivery', { p_lead_id: leadId ?? null })
  if (error) return 'queue_unavailable'
  if (!data) return 'idle'
  const delivery = data as Delivery
  async function checkpoint(patch: Record<string, unknown>) {
    const result = await admin.rpc('checkpoint_insurance_quote_delivery', { p_lead_id: delivery.lead_id, p_token: delivery.claim_token, p_patch: patch })
    if (result.error || result.data !== true) throw new Error('lease_lost')
  }
  try {
    const result = await admin.from('leads').select('household_id,lead_type,raw_payload,consent_snapshot,duplicate_review_status').eq('id', delivery.lead_id).is('deleted_at', null).single()
    if (result.error || !result.data) throw new DeliveryHold('lead_unavailable')
    const lead = result.data
    const household = await admin.from('households').select('id').eq('id', lead.household_id).is('deleted_at', null).is('merged_into_household_id', null).maybeSingle()
    if (household.error) throw new Error('household_lookup_failed')
    if (!household.data) throw new DeliveryHold('household_unavailable')
    const raw = record(lead.raw_payload), consent = record(lead.consent_snapshot)
    if (!isQuoteLead(lead.lead_type) || !isQuoteKind(raw.quoteKind) || consent.contactPermission !== true) throw new DeliveryHold('consent_or_type')
    if (lead.duplicate_review_status === 'pending') {
      await checkpoint({ status: 'pending', last_code: 'awaiting_local_review' }); return 'pending'
    }
    const members = await admin.from('household_members').select('id,first_name,last_name').eq('household_id',lead.household_id).eq('is_primary_contact',true).is('deleted_at',null)
    if (members.error) throw new Error('member_lookup_failed')
    const matches = (members.data ?? []).filter(member => member.first_name?.trim().toLowerCase() === String(raw.firstName).trim().toLowerCase() && member.last_name?.trim().toLowerCase() === String(raw.lastName).trim().toLowerCase())
    if (matches.length !== 1) throw new DeliveryHold('member_ambiguous')
    const identity = { firstName: String(raw.firstName), lastName: String(raw.lastName), email: String(raw.email), phone: String(raw.phone), kind: raw.quoteKind, memberId: matches[0].id }
    const links = createIntegrationContactLinkRepository(admin as unknown as IntegrationContactLinkAdmin)
    const linkInput = { provider: 'agentcrm', locationId: QUOTE_LOCATION, householdMemberId: identity.memberId }
    const link = await links.findByMember(linkInput)
    if (link.status === 'error') throw new Error('link_read_failed')
    await deliverQuote({ delivery, identity, transport: quoteTransport(env), linkedContactId: link.status === 'found' ? link.link.externalContactId : null, checkpoint,
      async saveLink(externalContactId) {
        const saved = await links.saveVerifiedLink({ ...linkInput, externalContactId })
        if (saved.status === 'conflict') throw new DeliveryHold('link_conflict')
        if (saved.status === 'error') throw new Error('link_write_failed')
      },
    })
    return 'synced'
  } catch (error) {
    // Persist only controlled status codes; never provider response bodies or client identity.
    const held = error instanceof DeliveryHold
    try { await checkpoint({ status: held ? 'held' : 'pending', last_code: held ? error.message : 'delivery_retry' }) } catch { /* expired lease is reclaimed safely */ }
    return held ? 'held' : 'pending'
  }
}
