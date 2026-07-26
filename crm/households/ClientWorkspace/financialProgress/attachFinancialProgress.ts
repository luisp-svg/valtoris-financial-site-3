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
 * Maps loaded workspace data into engine input.
 * Presentation layers must not re-derive this — call only from the workspace hook.
 */
export function toFinancialProgressInput(
  workspace: CrmHouseholdWorkspace,
): HouseholdFinancialProgressInput {
  return {
    household: workspace.household,
    assessments: {
      family: workspace.familyAssessment,
      business: workspace.businessAssessment,
      protection: workspace.protectionAssessment,
      retirement: null,
    },
    policies: workspace.activePolicies,
    openTasks: workspace.openTasks,
    openOpportunities: workspace.openOpportunities,
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
