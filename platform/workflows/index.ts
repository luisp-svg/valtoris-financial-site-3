/**
 * Platform Workflow Engine — public API (Sprint 4B.5 foundation).
 * TypeScript-only: no persistence, no execution runtime, no automations, no UI.
 *
 * Related to Case Engine via caseType only. Workflow stages are not Case stages.
 */

export type {
  CreateWorkflowInstanceDraftInput,
  WorkflowActionKey,
  WorkflowDefinition,
  WorkflowEngineMetadata,
  WorkflowGuardContext,
  WorkflowGuardKey,
  WorkflowGuardResult,
  WorkflowInstanceDraft,
  WorkflowKey,
  WorkflowReopenPolicy,
  WorkflowStageColor,
  WorkflowStageDefinition,
  WorkflowStageHistoryEntry,
  WorkflowStageKey,
  WorkflowStageKind,
  WorkflowTransitionDefinition,
  WorkflowTransitionResult,
} from './types'

export {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  getWorkflowForCaseType,
  isKnownWorkflowKey,
  listWorkflowDefinitions,
  listWorkflowKeys,
  listWorkflowsForModule,
  requireWorkflowDefinition,
  requireWorkflowForCaseType,
  validateWorkflowRegistry,
} from './workflowRegistry'

export {
  applyWorkflowClosure,
  canReopenWorkflow,
  getWorkflowCompletionPercent,
  getWorkflowEntryStage,
  getWorkflowStageDefinition,
  isWorkflowBlockedStage,
  isWorkflowEntryStage,
  isWorkflowTerminalStage,
  listWorkflowStagesOrdered,
} from './lifecycle'

export {
  assertCanTransitionWorkflowStage,
  canTransitionWorkflowStage,
  findWorkflowTransition,
  listAllowedWorkflowTransitions,
  listWorkflowTransitions,
  transitionWorkflowStage,
} from './transitions'

export {
  WORKFLOW_GUARD_CATALOG,
  evaluateWorkflowGuard,
  evaluateWorkflowGuards,
  isKnownWorkflowGuard,
  listWorkflowGuardKeys,
} from './guards'

export {
  advanceWorkflowInstanceDraft,
  createWorkflowInstanceDraft,
  selectAllowedActionsForStage,
  selectOpenWorkflowInstances,
  selectRequiredDocumentsForStage,
  selectRequiredTasksForStage,
  selectSuggestedActivitiesForStage,
  selectSuggestedAiPromptsForStage,
  selectWorkflowInstancesByCaseType,
  selectWorkflowInstancesForEnabledModules,
  selectWorkflowProgress,
  selectWorkflowStage,
  validateCreateWorkflowInstanceDraftInput,
} from './selectors'

export {
  buildCreditRepairWorkflowExample,
  buildFundingWorkflowExample,
  buildIfdWorkflowExample,
  buildInsuranceWorkflowExample,
  type CreditRepairWorkflowExampleInput,
  type FundingWorkflowExampleInput,
  type IfdWorkflowExampleInput,
  type InsuranceWorkflowExampleInput,
} from './examples'
