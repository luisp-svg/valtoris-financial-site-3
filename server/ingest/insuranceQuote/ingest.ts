import { syncQuoteDelivery } from '../../agentcrm/insurance/worker.js'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'
import { normalizeEmail, normalizePhone } from '../../../crm/households/normalizeContact.js'
import { findMatchCandidates } from '../familyReportCard/findCandidates.js'
import { classifyMatch } from '../familyReportCard/match.js'
import { validateQuote } from '../../../modules/insuranceQuote/validation.js'
import { QUOTE_CONTACT_COPY, QUOTE_STORAGE_COPY } from '../../../modules/insuranceQuote/catalog.js'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}'
  return JSON.stringify(value)
}
export async function ingestQuote(body: unknown, deps: { admin?: SupabaseClient; findCandidates?: typeof findMatchCandidates; now?: number } = {}): Promise<{ status: number; body: { ok: boolean; error?: string } }> {
  const checked = validateQuote(body, deps.now)
  if (!checked.ok) return { status: 400, body: { ok: false, error: checked.error } }
  const request = checked.value
  const contact = Object.fromEntries(Object.entries(request.contact).map(([key, value]) => [key, value.trim()])) as typeof request.contact
  const email = normalizeEmail(contact.email), phone = normalizePhone(contact.phone)
  const fingerprint = createHash('sha256').update(canonical({ kind: request.kind, version: request.version, contact, answers: request.answers, consent: request.consent })).digest('hex')
  try {
    const admin = deps.admin ?? createSupabaseAdminClient()
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidates = await (deps.findCandidates ?? findMatchCandidates)(admin, { normalizedEmail: email, normalizedPhone: phone })
      let match = classifyMatch({ normalizedEmail: email, normalizedPhone: phone, firstName: contact.firstName, lastName: contact.lastName, candidates })
      // Public insurance details never attach on a partial name match or unknown identity.
      if (match.status === 'exact_trusted_match') {
        const exact = candidates.filter(candidate => candidate.householdId === match.matchedHouseholdId)
        if (attempt > 0 || !exact.some(candidate => candidate.firstName?.trim().toLowerCase() === contact.firstName.toLowerCase() && candidate.lastName?.trim().toLowerCase() === contact.lastName.toLowerCase())) {
          match = { status: 'possible_match', candidateHouseholdId: match.matchedHouseholdId, matchReason: 'exact_contact_name_conflict', matchConfidence: 'low', candidatesConsidered: candidates.length }
        }
      }
      const now = new Date(deps.now ?? Date.now()).toISOString()
      const { data, error } = await admin.rpc('ingest_insurance_quote', { p_payload: {
        kind: request.kind, idempotency_key: request.submissionId, fingerprint,
        first_name: contact.firstName, last_name: contact.lastName, normalized_email: email, normalized_phone: phone,
        match_status: match.status, matched_household_id: match.matchedHouseholdId ?? null,
        candidate_household_id: match.candidateHouseholdId ?? null, match_reason: match.matchReason, match_confidence: match.matchConfidence,
        raw_payload: { version: 1, quoteKind: request.kind, ...contact, quoteAnswers: request.answers },
        consent_snapshot: { quoteStorageAcknowledged: true, contactPermission: true, privacyAcknowledged: true, emailMarketingConsent: false, smsMarketingConsent: false, preferredContact: contact.preferredContact, consentVersion: request.consent.version, consentedAt: now, storageDisclosure: QUOTE_STORAGE_COPY, contactDisclosure: QUOTE_CONTACT_COPY, sourcePage: `/${request.kind}-quote` },
      } })
      if (error?.message?.includes('retry_match')) continue
      if (error?.message?.includes('idempotency_conflict')) return { status: 409, body: { ok: false, error: 'A different version of this request was already saved. Please contact Valtoris to update it.' } }
      if (error || !data || typeof data.lead_id !== 'string' || typeof data.household_id !== 'string') break
      try { await syncQuoteDelivery(data.lead_id, { admin }) } catch { /* Saved quote remains queued; external failures never lose intake. */ }
      // Do not expose contact matching, database IDs, or underwriting data publicly.
      return { status: 200, body: { ok: true } }
    }
  } catch { /* Never log request bodies, raw database errors or credentials. */ }
  return { status: 503, body: { ok: false, error: 'Unable to save your request. Please try again.' } }
}
