import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../lib/supabase/admin.js'
import { normalizeEmail, normalizePhone } from '../../crm/households/normalizeContact.js'
import { readAgentCrmConfig } from './config.js'
import { LeadConnectorClient } from './client.js'
import { isAgentCrmReportCardSyncEnabled } from './reportCardSyncGate.js'
import { isAgentCrmContactLinkingEnabled } from './contactLinkGate.js'
import { getReportCardAgentCrmConfig } from './reportCardSyncConfig.js'
import { runReportCardAgentCrmSync, type ReportCardSyncInput } from './reportCardSync.js'
import { DeliveryHold, record } from './insurance/deliver.js'

type ReportDelivery = { lead_id: string; claim_token: string; delivery_kind: string; target_location_id: string; contact_id: string | null; contact_create_started: boolean; tag_write_started: boolean; tag_applied: boolean }
export function canonicalReportIdentity(lead: Record<string, unknown>, members: Record<string, unknown>[]): ReportCardSyncInput {
  if (!lead.consent_snapshot || typeof lead.consent_snapshot !== 'object' || Array.isArray(lead.consent_snapshot)) throw new DeliveryHold('consent_missing')
  const consent = record(lead.consent_snapshot)
  if (consent.contactPermission !== true) throw new DeliveryHold('consent_missing')
  const type = typeof lead.assessment_type === 'string' ? lead.assessment_type : ''
  const card = getReportCardAgentCrmConfig(type)
  if (!card || lead.lead_type !== card.source) throw new DeliveryHold('type_mismatch')
  if (lead.duplicate_review_status === 'pending' || lead.status === 'duplicate_review') throw new DeliveryHold('identity_review_required')
  if (!lead.raw_payload || typeof lead.raw_payload !== 'object' || Array.isArray(lead.raw_payload)) throw new DeliveryHold('invalid_identity')
  const raw = record(lead.raw_payload)
  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : ''
  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : ''
  const email = normalizeEmail(typeof lead.normalized_email === 'string' ? lead.normalized_email : '')
  const phone = normalizePhone(typeof lead.normalized_phone === 'string' ? lead.normalized_phone : '')
  if (!firstName || !lastName || !email || (!phone && typeof lead.normalized_phone === 'string' && lead.normalized_phone.trim())) throw new DeliveryHold('invalid_identity')
  const matches = members.filter(m => typeof m.id === 'string' && String(m.first_name ?? '').trim().toLowerCase() === firstName.toLowerCase() && String(m.last_name ?? '').trim().toLowerCase() === lastName.toLowerCase())
  if (matches.length !== 1) throw new DeliveryHold('member_ambiguous')
  return { assessmentType: type, matchStatus: 'verified_canonical', contactPermission: true, memberId: String(matches[0].id), submissionId: String(lead.id), firstName, lastName, email, phone }
}
export function verifyReportContact(value: unknown, location: string, input: ReportCardSyncInput, tag: string, expectedId?: string): { hasTag: boolean } {
  const contact = record(record(value).contact)
  if ((expectedId !== undefined && contact.id !== expectedId) || contact.locationId !== location || normalizeEmail(String(contact.email ?? '')) !== input.email || normalizePhone(String(contact.phone ?? '')) !== input.phone
    || String(contact.firstName ?? '').trim().toLowerCase() !== input.firstName.trim().toLowerCase()
    || String(contact.lastName ?? '').trim().toLowerCase() !== input.lastName.trim().toLowerCase()) throw new DeliveryHold('contact_verification_failed')
  return { hasTag: Array.isArray(contact.tags) && contact.tags.includes(tag) }
}
/** Only a persisted lead ID enters this worker; browser identity and replay fields are ignored. */
export async function syncReportCardDelivery(leadId?: string, deps: { admin?: SupabaseClient; env?: NodeJS.ProcessEnv; deadline?: number } = {}): Promise<string> {
  const deadline = deps.deadline ?? Date.now() + 45000
  if (deadline - Date.now() < 11000) return 'budget_exhausted'
  const env = deps.env ?? process.env
  if (!isAgentCrmReportCardSyncEnabled(env) || !isAgentCrmContactLinkingEnabled(env)) return 'disabled'
  const config = readAgentCrmConfig(env)
  if (!config.configured) return 'disabled'
  const admin = deps.admin ?? createSupabaseAdminClient()
  const claim = await admin.rpc('claim_report_card_delivery', { p_location: config.locationId, p_lead_id: leadId ?? null })
  if (claim.error) return 'queue_unavailable'
  if (!claim.data) return 'idle'
  const delivery = claim.data as ReportDelivery
  async function checkpoint(patch: Record<string, unknown>) {
    if (deadline - Date.now() < 11000 && !patch.status) throw new Error('delivery_deadline')
    const result = await admin.rpc('checkpoint_insurance_quote_delivery', { p_lead_id: delivery.lead_id, p_token: delivery.claim_token, p_patch: patch })
    if (result.error || result.data !== true) throw new Error('lease_lost')
  }
  try {
    if (delivery.delivery_kind !== 'report_card' || delivery.target_location_id !== config.locationId) throw new DeliveryHold('location_changed')
    const result = await admin.from('leads').select('id,household_id,assessment_type,lead_type,status,raw_payload,consent_snapshot,normalized_email,normalized_phone,duplicate_review_status').eq('id', delivery.lead_id).is('deleted_at', null).single()
    if (result.error || !result.data) throw new DeliveryHold('lead_unavailable')
    const lead = result.data
    const household = await admin.from('households').select('id').eq('id', lead.household_id).is('deleted_at', null).is('merged_into_household_id', null).maybeSingle()
    if (household.error) throw new Error('household_lookup_failed')
    if (!household.data) throw new DeliveryHold('household_unavailable')
    const members = await admin.from('household_members').select('id,first_name,last_name').eq('household_id', lead.household_id).is('deleted_at', null)
    if (members.error) throw new Error('member_lookup_failed')
    const input = canonicalReportIdentity(lead, members.data ?? [])
    const reader = new LeadConnectorClient({ token: config.token })
    const decision = await runReportCardAgentCrmSync(input, { admin, env, triggersVerified: env.AGENTCRM_REPORT_CARD_TRIGGERS_VERIFIED === 'true', delivery: {
      contactId: delivery.contact_id, createStarted: delivery.contact_create_started, tagStarted: delivery.tag_write_started, tagApplied: delivery.tag_applied,
      checkpoint,
      async verifyContact(id, identity, tag) {
        if (!/^[a-zA-Z0-9]{1,128}$/.test(id)) throw new DeliveryHold('invalid_contact_id')
        await checkpoint({})
        return verifyReportContact(await reader.get(`/contacts/${id}`), config.locationId, identity, tag, id)
      },
    } })
    if (!decision) throw new DeliveryHold('type_mismatch')
    if (['ALREADY_LINKED','LINKED_EXISTING_CONTACT','CREATED_AND_LINKED_CONTACT'].includes(decision.status)) {
      await checkpoint({ status: 'synced', last_code: 'verified' }); return 'synced'
    }
    const retry = ['INTEGRATION_ERROR','CONTACT_CREATED_LINK_FAILED','TAG_FAILED','NO_CONTACT_FOUND'].includes(decision.status)
    // Store only controlled codes, never remote response bodies or identity.
    const holdReasons = ['contact_outcome_unknown','tag_outcome_unknown','link_conflict','contact_verification_failed','invalid_contact_id']
    const code = decision.status === 'HELD' && holdReasons.includes(decision.reason) ? decision.reason : decision.status.toLowerCase()
    await checkpoint({ status: retry ? 'pending' : 'held', last_code: code })
    return retry ? 'pending' : 'held'
  } catch (error) {
    const held = error instanceof DeliveryHold
    try { await checkpoint({ status: held ? 'held' : 'pending', last_code: held ? error.message : 'delivery_retry' }) } catch { /* Lease is fenced; another attempt reconciles safely. */ }
    return held ? 'held' : 'pending'
  }
}
