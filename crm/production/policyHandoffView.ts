/**
 * Case → Policy handoff projection for Production detail.
 * Uses already-loaded application + linked_policies embed. No extra fetch.
 */
import { crmHouseholdPoliciesPath } from '../../constants/routes'
import { formatHouseholdPolicyStatus } from '../households/householdPoliciesView'
import { getActiveLinkedPolicy } from './daysInStage'
import { formatProductionStageLabel } from './labels'
import { formatProductionDate } from './productionApi'
import type { ProductionApplicationDetail, ProductionApplicationListItem } from './types'

export const VIEW_IN_HOUSEHOLD_POLICIES_LABEL = 'View in Household Policies'
export const VIEW_CASE_LABEL = 'View Case'
export const CASE_POLICY_STATUS_SEPARATE_NOTE =
  'Case stage and Policy status are recorded separately.'

export type LinkedPolicyHandoffModel = {
  visible: boolean
  policyId: string | null
  policyNumber: string
  policyStatusLabel: string | null
  policyStatusRaw: string | null
  effectiveDateLabel: string | null
  caseStageLabel: string
  householdPoliciesHref: string | null
  showDivergentNotTakenIssuedNote: boolean
}

export function linkedPolicyHandoffModel(
  application: Pick<
    ProductionApplicationListItem | ProductionApplicationDetail,
    'household_id' | 'production_stage' | 'issue_date' | 'in_force_date' | 'linked_policies'
  >,
): LinkedPolicyHandoffModel {
  const linked = getActiveLinkedPolicy(application)
  if (!linked || linked.deleted_at) {
    return {
      visible: false,
      policyId: null,
      policyNumber: 'None',
      policyStatusLabel: null,
      policyStatusRaw: null,
      effectiveDateLabel: null,
      caseStageLabel: formatProductionStageLabel(application.production_stage),
      householdPoliciesHref: null,
      showDivergentNotTakenIssuedNote: false,
    }
  }
  const effective = application.in_force_date || application.issue_date
  const statusRaw = linked.status?.trim() || null
  return {
    visible: true,
    policyId: linked.id,
    policyNumber: linked.policy_number?.trim() || 'No policy number',
    policyStatusLabel: statusRaw ? formatHouseholdPolicyStatus(statusRaw) : null,
    policyStatusRaw: statusRaw,
    effectiveDateLabel: effective ? formatProductionDate(effective) : null,
    caseStageLabel: formatProductionStageLabel(application.production_stage),
    householdPoliciesHref: crmHouseholdPoliciesPath(application.household_id),
    showDivergentNotTakenIssuedNote:
      application.production_stage === 'not_taken' && statusRaw?.toLowerCase() === 'issued',
  }
}
