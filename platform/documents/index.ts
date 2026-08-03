/**
 * Platform Document Engine — public API (Sprint 4B.6 foundation).
 * TypeScript-only: no uploads, storage, OCR, AI, persistence, routes, or UI.
 *
 * Exports document type definitions and requirement drafts — not files.
 */

export type {
  CreateDocumentRequirementDraftInput,
  DocumentAiExtractionHint,
  DocumentCategoryDefinition,
  DocumentCategoryKey,
  DocumentCategoryKeyCanonical,
  DocumentEngineMetadata,
  DocumentExpirationMetadata,
  DocumentLifecycleStatus,
  DocumentModuleKey,
  DocumentRequirementDraft,
  DocumentRetentionPolicy,
  DocumentReviewMetadata,
  DocumentTypeDefinition,
  DocumentTypeKey,
  DocumentValidationContext,
  DocumentValidationResult,
  DocumentValidationRuleKey,
  DocumentVersionMetadata,
  DocumentVisibility,
  DocumentWorkflowDependency,
} from './types'

export {
  DOCUMENT_CATEGORIES,
  getDocumentCategory,
  isKnownDocumentCategory,
  listDocumentCategories,
  listDocumentCategoryKeys,
} from './categories'

export {
  DOCUMENT_TYPE_DEFINITIONS,
  getDocumentTypeDefinition,
  isKnownDocumentType,
  listDocumentTypeDefinitions,
  listDocumentTypeKeys,
  requireDocumentTypeDefinition,
  validateDocumentRegistry,
} from './documentRegistry'

export {
  buildRequiredDocumentChecklist,
  isDocumentRequiredForCaseType,
  listExpiringDocuments,
  listOptionalDocumentsForCaseType,
  listOptionalDocumentsForModule,
  listRequiredDocumentsForCaseType,
  listRequiredDocumentsForModule,
  listReviewRequiredDocuments,
} from './requirements'

export {
  DOCUMENT_VALIDATION_RULE_CATALOG,
  isKnownDocumentValidationRule,
  isMimeTypeAllowed,
  isSizeWithinLimit,
  listDocumentValidationRuleKeys,
  validateDocumentMetadata,
} from './validation'

export {
  createDocumentRequirementDraft,
  selectDocumentByKey,
  selectDocumentCategorySummary,
  selectDocumentsByCaseType,
  selectDocumentsByCategory,
  selectDocumentsByModule,
  selectDocumentsForEnabledModules,
  selectVersionableDocuments,
  validateCreateDocumentRequirementDraftInput,
} from './selectors'

export {
  buildFundingRequiredDocumentsExample,
  buildIfdReportDocumentExample,
  buildInsuranceApplicationDocumentExample,
  buildOnboardingIdentityDocumentExample,
  type FundingDocumentChecklistExampleInput,
  type IfdDocumentExampleInput,
  type InsuranceDocumentExampleInput,
  type OnboardingDocumentExampleInput,
} from './examples'
