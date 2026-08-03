/**
 * Case Engine types — Platform Constitution (Sprint 4B.4).
 *
 * Foundation is TypeScript-first. No `public.cases` table yet.
 * Cases are in-memory / future-persistence shapes. Do not treat
 * metadata.caseId on activities as a relational FK until a migration lands.
 */

export type CaseId = string

export type CaseModuleKey = string

/** Stable case type keys (snake_case, usually suffixed with _case). */
export type CaseTypeKey = string

/**
 * Coarse operational status for a Case.
 * Distinct from module-specific stage strings.
 */
export type CaseStatus =
  | 'draft'
  | 'intake'
  | 'active'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'archived'

export type CasePriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Module-defined stage label (free string constrained by case type registry).
 * Not a DB enum in v1.
 */
export type CaseStage = string

export type CaseActorRef = {
  userId: string
  displayName?: string | null
}

/**
 * Soft links to existing CRM entities.
 * These are identifiers only — no FK enforcement without a future migration.
 */
export type CaseEntityLinks = {
  householdId: string
  /** Reserved for future business entity. */
  businessId?: string | null
  leadId?: string | null
  assessmentId?: string | null
  opportunityId?: string | null
  primaryTaskId?: string | null
  documentIds?: readonly string[]
  noteIds?: readonly string[]
  recommendationIds?: readonly string[]
  policyIds?: readonly string[]
  annualReviewIds?: readonly string[]
  activityIds?: readonly string[]
  taskIds?: readonly string[]
}

/**
 * Allow-listed Case metadata for foundation builders.
 * Never store raw answers, consent blobs, or secrets here.
 */
export type CaseEngineMetadata = {
  /** Soft idempotency hint for future persistence. */
  idempotencyKey?: string
  source?: string
  captureChannel?: string
  assessmentType?: string
  workflowHint?: string
  aiSummaryRef?: string | null
  portalVisible?: boolean
  [key: string]: unknown
}

/**
 * Canonical Case record shape (not persisted in this sprint).
 *
 * Cases are optional engagement containers. Do NOT assume every task, activity,
 * note, assessment, lead, appointment, or opportunity must belong to a Case.
 * Opportunities remain the commercial pipeline object; Cases are service delivery.
 */
export type PlatformCase = {
  /**
   * Client-generated draft identifier for in-memory Case shapes.
   * NOT a database-confirmed identity — no `public.cases` table exists yet.
   */
  id: CaseId
  caseType: CaseTypeKey
  /** Always derived from the Case type registry — never trusted from callers. */
  moduleKey: CaseModuleKey
  status: CaseStatus
  /** Module-specific stage — separate from coarse `status`. */
  stage: CaseStage
  priority: CasePriority
  title: string
  summary?: string | null
  /** Soft entity references only (ids). Never copied household/assessment payloads. */
  links: CaseEntityLinks
  ownerUserId?: string | null
  assignedAdvisorUserId?: string | null
  createdByUserId?: string | null
  openedAt: string
  closedAt?: string | null
  dueDate?: string | null
  metadata: CaseEngineMetadata
  /** Future: AI summary artifact id (reference only). */
  aiSummaryRef?: string | null
  /** Future: workflow definition / run ids (references only). */
  workflowDefinitionId?: string | null
  workflowRunId?: string | null
  /** True when this object was built by createCaseDraft / examples (non-persistent). */
  isDraft: true
}

export type CreateCaseDraftInput = {
  caseType: CaseTypeKey
  householdId: string
  title?: string
  summary?: string | null
  status?: CaseStatus
  stage?: CaseStage
  priority?: CasePriority
  leadId?: string | null
  assessmentId?: string | null
  opportunityId?: string | null
  ownerUserId?: string | null
  assignedAdvisorUserId?: string | null
  createdByUserId?: string | null
  openedAt?: string
  dueDate?: string | null
  metadata?: CaseEngineMetadata
  /**
   * Optional client-generated draft id for tests / soft idempotency previews.
   * Never treated as a persisted database Case id.
   */
  id?: CaseId
}

export type CaseTypeDefinition = {
  caseType: CaseTypeKey
  moduleKey: CaseModuleKey
  displayName: string
  description: string
  /** Initial status when a draft Case is created. */
  initialStatus: CaseStatus
  /** Initial stage key for this case type. */
  initialStage: CaseStage
  /** Ordered stages for this case type (module-specific). */
  stages: readonly CaseStage[]
  /** Statuses this case type may enter. */
  allowedStatuses: readonly CaseStatus[]
  defaultPriority: CasePriority
  /** Example entity links this case type typically carries. */
  typicalLinks: ReadonlyArray<keyof CaseEntityLinks>
}

export type CaseStatusTransition = {
  from: CaseStatus
  to: CaseStatus
  /** Human reason / guard description for docs & tests. */
  reason?: string
}
