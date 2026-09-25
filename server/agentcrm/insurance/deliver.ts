import { normalizeEmail, normalizePhone } from '../../../crm/households/normalizeContact.js'
import { QUOTE_LOCATION, QUOTE_PIPELINE, QUOTE_STAGE } from './config.js'
import { classifyDuplicateContacts } from '../identityLookup.js'
import { parseDuplicateSearch } from '../duplicateContact.js'

export type Delivery = { lead_id: string; claim_token: string; contact_id: string | null; opportunity_id: string | null; contact_create_started: boolean; opportunity_create_started: boolean }
export type QuoteIdentity = { firstName: string; lastName: string; email: string; phone: string; kind: string; memberId: string }
export type QuoteTransport = {
  get(path: string, query?: Record<string, string | number>): Promise<unknown>
  write(method: 'POST' | 'PUT', path: string, body: Record<string, unknown>): Promise<unknown>
}
export class DeliveryHold extends Error {}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response')
  return value as Record<string, unknown>
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9]+$/.test(value)) throw new Error('invalid_id')
  return value
}
export async function deliverQuote(input: {
  delivery: Delivery; identity: QuoteIdentity; transport: QuoteTransport;
  linkedContactId: string | null;
  checkpoint(patch: Record<string, unknown>): Promise<void>;
  saveLink(contactId: string): Promise<void>;
}) {
  const { delivery, identity, transport: api, checkpoint } = input
  const email = normalizeEmail(identity.email)!, phone = normalizePhone(identity.phone)!
  if (!email || !phone || !['auto','home','commercial'].includes(identity.kind)) throw new DeliveryHold('invalid_identity')
  const byEmail = parseDuplicateSearch(await api.get('/contacts/search/duplicate', { locationId: QUOTE_LOCATION, email }))
  const byPhone = parseDuplicateSearch(await api.get('/contacts/search/duplicate', { locationId: QUOTE_LOCATION, number: phone }))
  let contactId = delivery.contact_id ?? input.linkedContactId
  if (delivery.contact_id && input.linkedContactId && delivery.contact_id !== input.linkedContactId) throw new DeliveryHold('link_conflict')
  if (contactId) {
    contactId = id(contactId)
    if ([byEmail, byPhone].some(match => match && match.id !== contactId)) throw new DeliveryHold('identity_conflict')
    const existing = record(record(await api.get(`/contacts/${contactId}`)).contact)
    if (existing.locationId !== QUOTE_LOCATION) throw new DeliveryHold('location_conflict')
  } else {
    if ([byEmail, byPhone].some(match => match && (match.firstName?.trim().toLowerCase() !== identity.firstName.trim().toLowerCase() || match.lastName?.trim().toLowerCase() !== identity.lastName.trim().toLowerCase()))) throw new DeliveryHold('identity_conflict')
    const match = classifyDuplicateContacts({ candidate: identity, normalizedEmail: email, normalizedPhone: phone, emailContact: byEmail, phoneContact: byPhone })
    if (match.status === 'AMBIGUOUS') throw new DeliveryHold('identity_conflict')
    if (match.status === 'EXACT_EXISTING_CONTACT') contactId = id(match.externalContactId)
    else if (match.status !== 'NO_CONTACT_FOUND') throw new Error('identity_lookup_failed')
  }
  const contact = { firstName: identity.firstName, lastName: identity.lastName, email, phone }
  if (!contactId) {
    // A lost create response must be reconciled, never blindly created again.
    if (delivery.contact_create_started) throw new DeliveryHold('contact_outcome_unknown')
    await checkpoint({ contact_create_started: true })
    const result = record(await api.write('POST', '/contacts/upsert', { ...contact, locationId: QUOTE_LOCATION, source: `Valtoris /${identity.kind}-quote` }))
    contactId = id(record(result.contact).id)
    await checkpoint({ contact_id: contactId })
  } else {
    await checkpoint({ contact_id: contactId })
    await api.write('PUT', `/contacts/${contactId}`, contact)
  }
  const verified = record(record(await api.get(`/contacts/${contactId}`)).contact)
  if (verified.locationId !== QUOTE_LOCATION || normalizeEmail(String(verified.email ?? '')) !== email || normalizePhone(String(verified.phone ?? '')) !== phone
      || verified.firstName !== identity.firstName || verified.lastName !== identity.lastName) throw new DeliveryHold('contact_verification_failed')
  await input.saveLink(contactId)

  async function opportunities() {
    const result = record(await api.get('/opportunities/search', { location_id: QUOTE_LOCATION, pipeline_id: QUOTE_PIPELINE, contact_id: contactId!, status: 'open', limit: 100 }))
    if (!Array.isArray(result.opportunities)) throw new Error('invalid_opportunities')
    const rows = result.opportunities.map(record)
    const meta = result.meta && typeof result.meta === 'object' ? record(result.meta) : {}
    if (rows.length > 1 || Number(meta.total ?? 0) > 1 || meta.nextPage) throw new DeliveryHold('multiple_opportunities')
    for (const row of rows) {
      const rowContact = row.contactId ?? (row.contact ? record(row.contact).id : null)
      if (rowContact !== contactId || row.pipelineId !== QUOTE_PIPELINE || row.status !== 'open') throw new DeliveryHold('opportunity_scope_conflict')
    }
    return rows
  }
  const existing = await opportunities()
  let opportunityId = existing[0] ? id(existing[0].id) : null
  if (!opportunityId) {
    // AgentCRM's search index can lag a successful create. A persisted ID
    // permits a later read-only reconciliation, never another create.
    if (delivery.opportunity_id) throw new Error('opportunity_search_pending')
    if (delivery.opportunity_create_started) throw new DeliveryHold('opportunity_outcome_unknown')
    await checkpoint({ opportunity_create_started: true })
    const response = record(await api.write('POST', '/opportunities/', {
      locationId: QUOTE_LOCATION, contactId, pipelineId: QUOTE_PIPELINE, pipelineStageId: QUOTE_STAGE,
      name: `${identity.firstName} ${identity.lastName} — Insurance quote`, status: 'open', source: `Valtoris /${identity.kind}-quote`,
    }))
    opportunityId = id(record(response.opportunity).id)
    await checkpoint({ opportunity_id: opportunityId })
  } else if (delivery.opportunity_id && delivery.opportunity_id !== opportunityId) {
    throw new DeliveryHold('opportunity_link_conflict')
  }
  // Existing stages are preserved. Read-back checks also catch a concurrent duplicate.
  const verifiedOpportunities = await opportunities()
  if (verifiedOpportunities.length === 0) throw new Error('opportunity_search_pending')
  if (verifiedOpportunities.length !== 1 || verifiedOpportunities[0].id !== opportunityId) throw new DeliveryHold('opportunity_verification_failed')
  await checkpoint({ opportunity_id: opportunityId, status: 'synced', last_code: 'verified' })
  return { contactId, opportunityId }
}
