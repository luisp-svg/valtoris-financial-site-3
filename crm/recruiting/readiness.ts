import type { CarrierReview, Credential } from './types'
/** Human-readable explanations; the server is the authority for readiness. */
export function readinessGaps(review: CarrierReview, credentials: Credential[], today: string): string[] {
  const current = (status: string, start: string | null, end: string | null, noEnd: boolean) => status === 'verified' && Boolean(start && start <= today && (noEnd || (end && end >= today)))
  const gaps: string[] = []
  if (!credentials.some(c => c.kind === 'license' && c.state === review.state && c.authority_scope?.trim().toLowerCase() === review.authority_scope.trim().toLowerCase() && current(c.status, c.effective_on, c.expires_on, c.no_expiration))) gaps.push('Current verified license for this state and scope')
  if (!credentials.some(c => c.kind === 'eo' && current(c.status, c.effective_on, c.expires_on, c.no_expiration))) gaps.push('Current verified E&O')
  if (!current(review.contract_status, review.contract_effective_on, review.contract_expires_on, review.contract_no_expiration)) gaps.push('Current verified contracting')
  if (!current(review.appointment_status, review.appointment_effective_on, review.appointment_expires_on, review.appointment_no_expiration)) gaps.push('Current verified appointment')
  if (!review.reviewed_at) gaps.push('Manager readiness review')
  return gaps
}
