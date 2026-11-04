import { calendarDaysSince } from '../dashboard/dates'
import { readinessGaps } from './readiness'
import type { CarrierReview, Credential, Recruit } from './types'

export const ATTENTION_FILTERS = [
  ['all', 'All agents'], ['licensing', 'Licensing in progress'],
  ['appointments', 'Appointments pending'], ['requirements', 'Requirements to review'],
  ['renewals', 'Renewals within 60 days'], ['expired', 'Expired records'],
  ['followup', 'Follow-up due'],
] as const
export type AttentionFilter = typeof ATTENTION_FILTERS[number][0]
export type Expiry = { id: string; label: string; date: string }

export function licensingSummary(record: Recruit, credentials: Credential[], carriers: CarrierReview[], today: string) {
  // Scope every calculation to this agent, even when passed agency-wide evidence.
  const ownCredentials = credentials.filter(c => c.recruit_id === record.id)
  const ownCarriers = carriers.filter(c => c.recruit_id === record.id)
  const expirations: Expiry[] = ownCredentials.filter(c => c.expires_on && !c.no_expiration && c.status !== 'revoked')
    .map(c => ({ id: c.id, label: c.kind === 'eo' ? 'E&O' : `License · ${c.state} · ${c.authority_scope}`, date: c.expires_on! }))
  for (const c of ownCarriers) {
    for (const prefix of ['contract', 'appointment'] as const) {
      const date = c[`${prefix}_expires_on`]
      if (date && !c[`${prefix}_no_expiration`] && c[`${prefix}_status`] !== 'revoked') {
        expirations.push({ id: `${c.id}-${prefix}`, label: `${prefix === 'contract' ? 'Contract' : 'Appointment'} · ${c.state} · ${c.authority_scope}`, date })
      }
    }
  }
  expirations.sort((a, b) => a.date.localeCompare(b.date))
  const expired = expirations.filter(e => e.date < today)
  const renewals = expirations.filter(e => { const days = calendarDaysSince(today, e.date); return days !== null && days >= 0 && days <= 60 })
  const licenseMissing = !ownCredentials.some(c => c.kind === 'license')
  const eoMissing = !ownCredentials.some(c => c.kind === 'eo')
  const carrierMissing = ownCarriers.length === 0
  const reviewsNeeded = ownCarriers.filter(c => readinessGaps(c, ownCredentials, today).length > 0)
  const credentialsToReview = ownCredentials.filter(c => c.status !== 'verified' || !c.effective_on || c.effective_on > today || (!c.expires_on && !c.no_expiration) || !c.evidence_reference)
  return {
    credentials: ownCredentials, carriers: ownCarriers, expired, renewals,
    states: [...new Set([...ownCredentials.map(c => c.state), ...ownCarriers.map(c => c.state)].filter((s): s is string => Boolean(s)))].sort(),
    licenseMissing, eoMissing, carrierMissing, reviewsNeeded, credentialsToReview,
    pendingAppointments: ownCarriers.filter(c => c.appointment_status === 'pending').length,
    pendingContracts: ownCarriers.filter(c => c.contract_status === 'pending').length,
    requirementsNeeded: licenseMissing || eoMissing || carrierMissing || reviewsNeeded.length > 0 || credentialsToReview.length > 0,
    followupDue: Boolean(record.next_action_due_on && record.next_action_due_on <= today),
  }
}
export function matchesAttention(record: Recruit, summary: ReturnType<typeof licensingSummary>, filter: AttentionFilter) {
  switch (filter) {
    case 'licensing': return record.stage === 'licensing'
    case 'appointments': return summary.pendingAppointments > 0
    case 'requirements': return summary.requirementsNeeded
    case 'renewals': return summary.renewals.length > 0
    case 'expired': return summary.expired.length > 0
    case 'followup': return summary.followupDue
    default: return true
  }
}
