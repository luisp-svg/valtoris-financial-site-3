import {
  CREDIT_REPAIR_VERTICAL_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from '../security/migration047Contract'
import { intakeProductLabel } from './intakeFormatters'
import type { IntakeQueueItem } from './types'

export type IntakeOpportunityVerticalSuggestion = {
  serviceVerticalId: string
  titlePrefix: string
}

/**
 * Intake lead_type is a suggestion only. Generic Report Cards have no approved
 * product mapping and must not force a vertical.
 *
 * `source_lead_id` is omitted in V1: the column exists, but createOpportunity
 * does not allowlist it, and INSERT RLS does not prove the lead belongs to the
 * same accessible household.
 */
export function suggestIntakeOpportunityVertical(
  leadType: string | null | undefined,
): IntakeOpportunityVerticalSuggestion | null {
  if (leadType === 'Student Loan Report Card') {
    return {
      serviceVerticalId: STUDENT_LOANS_VERTICAL_ID,
      titlePrefix: 'Student Loans',
    }
  }
  if (leadType === 'Credit Report Card') {
    return {
      serviceVerticalId: CREDIT_REPAIR_VERTICAL_ID,
      titlePrefix: 'Credit Repair',
    }
  }
  return null
}

export function suggestedIntakeOpportunityTitle(item: Pick<
  IntakeQueueItem,
  'leadType' | 'household' | 'submittedFullName' | 'diagnostic' | 'digitalIdentity'
>): string {
  const householdName =
    item.household?.displayName?.trim() || item.submittedFullName.trim() || 'Household'
  const suggestion = suggestIntakeOpportunityVertical(item.leadType)
  const prefix = suggestion?.titlePrefix ?? intakeProductLabel(item)
  return `${prefix} — ${householdName}`
}

export function buildIntakeOpportunityPrefill(item: IntakeQueueItem): {
  householdId: string | null
  householdLabel: string | null
  assignedAdvisorId: string | null
  serviceVerticalId: string | null
  title: string
  includeSourceLeadId: false
} {
  const suggestion = suggestIntakeOpportunityVertical(item.leadType)
  return {
    householdId: item.household?.id ?? item.householdId ?? null,
    householdLabel: item.household?.displayName ?? null,
    assignedAdvisorId: item.household?.assignedAdvisor?.id ?? item.assignedAdvisor?.id ?? null,
    serviceVerticalId: suggestion?.serviceVerticalId ?? null,
    title: suggestedIntakeOpportunityTitle(item),
    includeSourceLeadId: false,
  }
}
