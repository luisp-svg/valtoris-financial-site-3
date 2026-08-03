/**
 * Platform Case Engine — public API (Sprint 4B.4 foundation).
 * TypeScript-only: no database table, no module conversion, no data migration.
 */

export type {
  CaseActorRef,
  CaseEngineMetadata,
  CaseEntityLinks,
  CaseId,
  CaseModuleKey,
  CasePriority,
  CaseStage,
  CaseStatus,
  CaseStatusTransition,
  CaseTypeDefinition,
  CaseTypeKey,
  CreateCaseDraftInput,
  PlatformCase,
} from './types'

export {
  CASE_TYPE_DEFINITIONS,
  getCaseTypeDefinition,
  isKnownCaseType,
  listCaseTypeDefinitions,
  listCaseTypes,
  listCaseTypesForModule,
  requireCaseTypeDefinition,
} from './caseTypeRegistry'

export {
  CASE_OPEN_STATUSES,
  CASE_STATUS_TRANSITIONS,
  CASE_TERMINAL_STATUSES,
  applyCaseClosure,
  applyCaseReopen,
  assertCanTransitionCaseStatus,
  canSetCaseStage,
  canTransitionCaseStatus,
  isOpenCaseStatus,
  isTerminalCaseStatus,
  isValidStageForCaseType,
  transitionCaseStatus,
} from './lifecycle'

export {
  CASE_PUBLISH_METADATA_ALLOWLIST,
  buildCaseMetadata,
} from './metadata'

export {
  createCaseDraft,
  linkActivityToCase,
  selectCaseById,
  selectCasesByHousehold,
  selectCasesByModule,
  selectCasesByPriority,
  selectCasesByStatus,
  selectCasesByType,
  selectCasesForEnabledModules,
  selectClosedCases,
  selectOpenCases,
  sortCasesDeterministically,
  toActivityCaseLinkMetadata,
  validateCreateCaseDraftInput,
} from './selectors'

export {
  buildIfdCaseExample,
  buildOnboardingCaseExample,
  type IfdCaseExampleInput,
  type OnboardingCaseExampleInput,
} from './examples'
