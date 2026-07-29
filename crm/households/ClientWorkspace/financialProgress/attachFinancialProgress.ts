import {
  computeHouseholdFinancialProgress,
  type HouseholdFinancialProgressInput,
  type HouseholdFinancialProgressResult,
} from '../../../financial-progress'
import type { CrmHouseholdWorkspace } from '../../types'

/** Workspace view model with engine Progress Score attached once by the hook. */
export type ClientWorkspaceModel = CrmHouseholdWorkspace & {
  financialProgress: HouseholdFinancialProgressResult
}

/**
 * Parse a timestamp defensively into a stable ISO string.
 * Invalid, empty, or non-string values are ignored.
 */
export function parseValidIsoTimestamp(
  value: string | null | undefined,
): string | null {
  if (value == null || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Adapter-level `asOf` precedence (engine fallback unchanged when omitted):
 * 1. Most recent valid `completed_at` among assessments passed to the engine
 * 2. Annual-review `completed_at` when already on the workspace (evaluation date)
 * 3. No separate explicit evaluation timestamp exists on the workspace today
 * 4. Current timestamp as the final fallback
 *
 * Household created_at / updated_at are never used as evaluation substitutes.
 */
export function resolveFinancialProgressAsOf(
  workspace: CrmHouseholdWorkspace,
  now: () => Date = () => new Date(),
): string {
  const assessmentTimestamps = [
    workspace.familyAssessment?.completed_at,
    workspace.businessAssessment?.completed_at,
    workspace.protectionAssessment?.completed_at,
    workspace.retirementAssessment?.completed_at,
  ]
    .map(parseValidIsoTimestamp)
    .filter((value): value is string => value != null)

  if (assessmentTimestamps.length > 0) {
    return assessmentTimestamps.reduce((latest, current) =>
      current > latest ? current : latest,
    )
  }

  const reviewCompletedAt = parseValidIsoTimestamp(
    workspace.annualReview?.completed_at,
  )
  if (reviewCompletedAt) return reviewCompletedAt

  return now().toISOString()
}

/**
 * Maps loaded workspace data into engine input.
 * Presentation layers must not re-derive this — call only from the workspace hook.
 *
 * Policies and open tasks prefer complete scoring collections when the loader
 * provides them; UI preview arrays remain preview-limited for display.
 */
export function toFinancialProgressInput(
  workspace: CrmHouseholdWorkspace,
  options: { now?: () => Date } = {},
): HouseholdFinancialProgressInput {
  return {
    household: workspace.household,
    assessments: {
      family: workspace.familyAssessment,
      business: workspace.businessAssessment,
      protection: workspace.protectionAssessment,
      retirement: workspace.retirementAssessment,
    },
    policies: workspace.financialProgressPolicies ?? workspace.activePolicies,
    openTasks: workspace.financialProgressOpenTasks ?? workspace.openTasks,
    openOpportunities: workspace.openOpportunities,
    asOf: resolveFinancialProgressAsOf(workspace, options.now),
  }
}

/** Compute Household Financial Progress once and attach to the workspace model. */
export function attachFinancialProgress(
  workspace: CrmHouseholdWorkspace,
): ClientWorkspaceModel {
  return {
    ...workspace,
    financialProgress: computeHouseholdFinancialProgress(toFinancialProgressInput(workspace)),
  }
}
