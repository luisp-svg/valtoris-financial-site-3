/**
 * Example Workflow instance draft builders.
 *
 * Metadata / shape examples only:
 * - do NOT persist workflow runs
 * - do NOT execute transitions against CRM data
 * - do NOT create activities, tasks, documents, or cases
 * - do NOT alter IFD / insurance / credit / funding runtime behavior
 * - public IFD remains separate from Financial Progress
 * - credit / funding examples do not enable those modules at runtime
 * - suggestedAiPrompts identifiers do not invoke AI
 */

import { createWorkflowInstanceDraft } from './selectors'
import type { WorkflowInstanceDraft } from './types'

export type IfdWorkflowExampleInput = {
  caseDraftId?: string | null
  id?: string
  openedAt?: string
  currentStage?: string
}

/**
 * Example: IFD Review workflow draft at needs_review (or a provided stage).
 */
export function buildIfdWorkflowExample(
  input: IfdWorkflowExampleInput = {},
): WorkflowInstanceDraft {
  return createWorkflowInstanceDraft({
    id: input.id,
    caseType: 'diagnostic_review_case',
    workflowKey: 'ifd_review_workflow',
    caseDraftId: input.caseDraftId ?? null,
    currentStage: input.currentStage ?? 'needs_review',
    openedAt: input.openedAt,
    metadata: {
      source: 'public_family_report_card',
      idempotencyKey: input.caseDraftId
        ? `ifd_review_workflow:${input.caseDraftId}`
        : undefined,
      notes: 'Example only — not an executed IFD workflow run',
    },
  })
}

export type InsuranceWorkflowExampleInput = {
  caseDraftId?: string | null
  id?: string
  openedAt?: string
  currentStage?: string
}

/**
 * Example: Insurance Case workflow draft at application_started.
 */
export function buildInsuranceWorkflowExample(
  input: InsuranceWorkflowExampleInput = {},
): WorkflowInstanceDraft {
  return createWorkflowInstanceDraft({
    id: input.id,
    caseType: 'insurance_case',
    workflowKey: 'insurance_case_workflow',
    caseDraftId: input.caseDraftId ?? null,
    currentStage: input.currentStage ?? 'application_started',
    openedAt: input.openedAt,
    metadata: {
      source: 'insurance_module_example',
      notes: 'Example only — insurance runtime unchanged',
    },
  })
}

export type CreditRepairWorkflowExampleInput = {
  caseDraftId?: string | null
  id?: string
  openedAt?: string
}

/**
 * Example: Credit Repair workflow draft at enrollment.
 */
export function buildCreditRepairWorkflowExample(
  input: CreditRepairWorkflowExampleInput = {},
): WorkflowInstanceDraft {
  return createWorkflowInstanceDraft({
    id: input.id,
    caseType: 'credit_repair_case',
    workflowKey: 'credit_repair_workflow',
    caseDraftId: input.caseDraftId ?? null,
    openedAt: input.openedAt,
    metadata: {
      source: 'credit_repair_module_example',
      notes: 'Example only — credit repair runtime unchanged',
    },
  })
}

export type FundingWorkflowExampleInput = {
  caseDraftId?: string | null
  id?: string
  openedAt?: string
}

/**
 * Example: Business Funding workflow draft at qualification.
 */
export function buildFundingWorkflowExample(
  input: FundingWorkflowExampleInput = {},
): WorkflowInstanceDraft {
  return createWorkflowInstanceDraft({
    id: input.id,
    caseType: 'funding_case',
    workflowKey: 'business_funding_workflow',
    caseDraftId: input.caseDraftId ?? null,
    openedAt: input.openedAt,
    metadata: {
      source: 'business_funding_module_example',
      notes: 'Example only — funding runtime unchanged',
    },
  })
}
