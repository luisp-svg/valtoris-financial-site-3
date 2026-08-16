import {
  formatProductionParticipantRoleLabel,
  formatProductionProductLineLabel,
  formatProductionStageLabel,
} from './labels'
import {
  getActiveLinkedPolicy,
  getCurrentAllocations,
  getCurrentParticipants,
} from './daysInStage'
import { formatCents, formatProductionDate } from './productionApi'
import type { ProductionApplicationDetail, ProductionParticipantRole } from './types'

const DISPLAY_ROLES: ProductionParticipantRole[] = ['insured', 'annuitant', 'owner']

export type HouseholdProductionPolicyRow = {
  id: string
  carrier: string
  product: string
  productLine: string
  policyNumberDisplay: string
  applicationNumber: string | null
  roles: string
  stage: string
  premiumDisplay: string
  writingAdvisors: string
  dates: string
}

export function productionPolicyNumberDisplay(application: {
  policy_number: string | null
  application_number: string | null
  linked_policies: ProductionApplicationDetail['linked_policies']
}): string {
  const linked = getActiveLinkedPolicy(application)
  const policyNumber = linked?.policy_number?.trim() || application.policy_number?.trim() || ''
  if (policyNumber) return policyNumber
  const applicationNumber = application.application_number?.trim()
  if (applicationNumber) return `Application ${applicationNumber}`
  return 'Pending'
}

export function householdProductionRoles(application: ProductionApplicationDetail): string {
  const current = getCurrentParticipants(application.participants)
  const labels = DISPLAY_ROLES.flatMap((role) => {
    const matches = current.filter((row) => row.role === role)
    return matches.map((row) => {
      const name = [row.member?.first_name, row.member?.last_name].filter(Boolean).join(' ').trim()
      const roleLabel = formatProductionParticipantRoleLabel(role)
      return name ? `${roleLabel}: ${name}` : roleLabel
    })
  })
  return labels.length > 0 ? labels.join(' · ') : '—'
}

export function householdProductionPremium(application: ProductionApplicationDetail): string {
  if (application.product_line === 'fia') {
    return application.annuity_deposit_cents == null
      ? '—'
      : `Deposit ${formatCents(application.annuity_deposit_cents)}`
  }
  return application.submitted_premium_cents == null
    ? '—'
    : `Premium ${formatCents(application.submitted_premium_cents)}`
}

export function householdProductionWriters(application: ProductionApplicationDetail): string {
  const writing = getCurrentAllocations(application.allocations).filter(
    (row) => row.allocation_role === 'writing' && row.recipient_type === 'advisor',
  )
  if (writing.length === 0) return '—'
  const names = writing
    .map((row) => row.advisor?.display_name?.trim())
    .filter((name): name is string => Boolean(name))
  return names.length > 0 ? names.join(', ') : '—'
}

export function householdProductionDates(application: ProductionApplicationDetail): string {
  const parts = [
    application.submission_date ? `Applied ${formatProductionDate(application.submission_date)}` : null,
    application.issue_date ? `Issued ${formatProductionDate(application.issue_date)}` : null,
    application.in_force_date ? `In force ${formatProductionDate(application.in_force_date)}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function mapHouseholdProductionPolicy(
  application: ProductionApplicationDetail,
): HouseholdProductionPolicyRow {
  return {
    id: application.id,
    carrier: application.carrier?.name?.trim() || '—',
    product: application.product?.name?.trim() || '—',
    productLine: formatProductionProductLineLabel(application.product_line),
    policyNumberDisplay: productionPolicyNumberDisplay(application),
    applicationNumber: application.application_number,
    roles: householdProductionRoles(application),
    stage: formatProductionStageLabel(application.production_stage),
    premiumDisplay: householdProductionPremium(application),
    writingAdvisors: householdProductionWriters(application),
    dates: householdProductionDates(application),
  }
}
