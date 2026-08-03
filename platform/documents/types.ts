/**
 * Document Engine types — Platform Constitution (Sprint 4B.6).
 *
 * TypeScript-first foundation only. No uploads, storage, OCR, PDFs,
 * signatures, AI extraction, persistence, migrations, routes, or UI.
 *
 * The Document Engine defines document *types* and requirement metadata.
 * It does not store files and does not create Case/Workflow/Activity rows.
 *
 * Naming map (do not conflate):
 * - DocumentTypeDefinition = compiled type metadata (catalog row)
 * - DocumentRequirementDraft = in-memory checklist item (non-persistent)
 * - Future document record = persisted document row (not in 4B.6)
 * - Future file/version record = storage object / version row (not in 4B.6)
 * - Future review status = persisted review outcome (not in 4B.6)
 * - Future generated artifact = PDF/report bytes (not in 4B.6)
 *
 * A DocumentTypeDefinition / DocumentRequirementDraft is NOT:
 * an uploaded file, stored file, verified document, approved document,
 * OCR result, extracted-data result, signed document, generated PDF,
 * or compliance determination.
 *
 * Boundaries:
 * - Document type key ≠ stored file id
 * - Document lifecycle metadata ≠ Case status / Workflow stage
 * - reviewRoles / visibility are declarations only — not authorization
 * - retentionPolicy is descriptive metadata only — not a legal retention promise
 * - validationRules / mime / size are metadata — not upload enforcement,
 *   malware scanning, authenticity, identity verification, or legal sufficiency
 * - aiExtractionHints are identifiers only — do not invoke AI
 * - Soft links to caseType / module / workflow stage are references only
 */

export type DocumentTypeKey = string
export type DocumentCategoryKey = string
export type DocumentModuleKey = string

/**
 * Platform document categories (metadata taxonomy).
 * Distinct from Module Registry `category`.
 */
export type DocumentCategoryKeyCanonical =
  | 'identity'
  | 'financial'
  | 'insurance'
  | 'legal'
  | 'tax'
  | 'business'
  | 'medical'
  | 'property'
  | 'credit'
  | 'compliance'
  | 'advisor_generated'
  | 'client_generated'

/** Who may conceptually see the document type (metadata only — not ACL). */
export type DocumentVisibility = 'advisor' | 'client' | 'both' | 'internal'

/**
 * Declarative checklist / future-record lifecycle labels.
 * On DocumentRequirementDraft these are metadata only — they do NOT mean a
 * file was uploaded, verified, approved, signed, or legally retained.
 */
export type DocumentLifecycleStatus =
  | 'requested'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'archived'

/**
 * Descriptive retention intent for future policy engines.
 * Not encryption, deletion, legal hold, or compliance enforcement.
 */
export type DocumentRetentionPolicy =
  | 'session_only'
  | 'engagement'
  | 'seven_years'
  | 'permanent'
  | 'module_default'

export type DocumentValidationRuleKey =
  | 'has_file_reference'
  | 'mime_type_allowed'
  | 'size_within_limit'
  | 'not_expired'
  | 'review_approved'
  | 'page_count_present'
  | 'issued_date_present'

export type DocumentAiExtractionHint = {
  /** Future AI use-case / extractor key — never an executable function. */
  useCase: string
  description?: string
  fields?: readonly string[]
}

export type DocumentVersionMetadata = {
  /** Whether this document type supports versioning (metadata). */
  versionable: boolean
  /** Optional starting version label for drafts. */
  initialVersionLabel?: string
}

export type DocumentExpirationMetadata = {
  expires: boolean
  /** Renewal interval in days when expires=true (metadata). */
  renewalIntervalDays?: number | null
  /** Optional default validity window in days from issued/upload date. */
  defaultValidityDays?: number | null
}

export type DocumentReviewMetadata = {
  reviewRequired: boolean
  /** Declared role keys only — not Permission Engine grants. */
  reviewRoles?: readonly string[]
}

export type DocumentWorkflowDependency = {
  /** Soft workflow key reference (optional). */
  workflowKey?: string
  /** Soft workflow stage key where this document is typically required. */
  stageKey?: string
  required?: boolean
}

/**
 * Canonical document type definition (compiled catalog — not persisted).
 */
export type DocumentTypeDefinition = {
  key: DocumentTypeKey
  title: string
  description: string
  category: DocumentCategoryKeyCanonical
  /** Primary owning / consuming module. */
  moduleKey: DocumentModuleKey
  /** Optional related case type (soft link). */
  caseType?: string | null
  visibility: DocumentVisibility
  required: boolean
  expiration: DocumentExpirationMetadata
  version: DocumentVersionMetadata
  allowMultiple: boolean
  review: DocumentReviewMetadata
  validationRules: readonly DocumentValidationRuleKey[]
  supportedMimeTypes: readonly string[]
  maxSizeMB: number
  retentionPolicy: DocumentRetentionPolicy
  /** Activity event keys suggested around this document type (metadata). */
  activityEvents?: readonly string[]
  /** Soft workflow dependencies (metadata only). */
  workflowDependencies?: readonly DocumentWorkflowDependency[]
  /** Future AI extraction hints (identifiers only). */
  aiExtractionHints?: readonly DocumentAiExtractionHint[]
  /** Additional modules that commonly consume this type. */
  alsoUsedByModules?: readonly string[]
  /** Additional case types that commonly require this type. */
  alsoUsedByCaseTypes?: readonly string[]
}

export type DocumentCategoryDefinition = {
  key: DocumentCategoryKeyCanonical
  label: string
  description: string
  order: number
}

/**
 * In-memory document requirement / checklist draft.
 * Client-generated ids only — NOT a stored document, file, or verified artifact.
 * Advancing `status` never uploads, stores, approves, or signs anything.
 */
export type DocumentRequirementDraft = {
  /**
   * Client-generated draft identifier for in-memory requirement shapes.
   * NOT a database document id — no documents table exists yet.
   */
  id: string
  documentTypeKey: DocumentTypeKey
  moduleKey: DocumentModuleKey
  caseType?: string | null
  /** Soft Case draft link only — does not create or mutate a Case. */
  caseDraftId?: string | null
  required: boolean
  /** Checklist lifecycle label — not file verification or approval. */
  status: DocumentLifecycleStatus
  metadata: DocumentEngineMetadata
  openedAt: string
  isDraft: true
}

export type DocumentEngineMetadata = {
  source?: string
  idempotencyKey?: string
  notes?: string
  [key: string]: unknown
}

export type CreateDocumentRequirementDraftInput = {
  documentTypeKey: DocumentTypeKey
  moduleKey?: DocumentModuleKey
  caseType?: string | null
  caseDraftId?: string | null
  status?: DocumentLifecycleStatus
  openedAt?: string
  metadata?: DocumentEngineMetadata
  /** Optional client-generated draft id — never a DB document id. */
  id?: string
}

/**
 * Caller-asserted validation inputs.
 * These are NOT independently verified facts. The engine never inspects bytes,
 * storage objects, identity documents, malware, authenticity, or legal sufficiency.
 */
export type DocumentValidationContext = {
  hasFileReference?: boolean
  mimeType?: string | null
  sizeMB?: number | null
  expired?: boolean
  reviewApproved?: boolean
  pageCount?: number | null
  issuedDatePresent?: boolean
}

export type DocumentValidationResult =
  | { ok: true; documentTypeKey: DocumentTypeKey }
  | {
      ok: false
      documentTypeKey: DocumentTypeKey
      errors: readonly string[]
    }
