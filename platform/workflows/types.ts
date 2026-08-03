/**
 * Workflow Engine types — Platform Constitution (Sprint 4B.5).
 *
 * TypeScript-first foundation only. No workflow persistence, no execution,
 * no automations, no UI. Workflows declare stage machines that future Case /
 * Task / Document / AI engines will consult.
 *
 * A Workflow is NOT an Opportunity and is NOT automation.
 * One Workflow definition registers per Case Type.
 *
 * Case / Workflow boundary (not yet unified):
 * - Case status = broad service lifecycle (draft/intake/active/…)
 * - Case stage = Case Engine metadata string for that case type
 * - Workflow stage = declarative process position in this engine
 * - Linkage today = caseType only (no silent stage-key mapping by string equality)
 * - Changing a workflow draft does NOT mutate a Case
 * - Workflow completion does NOT imply Case persistence or Case completion
 * - Guards are NOT authorization checks
 * - requiredDocuments / requiredTasks / suggestedActivities / suggestedAiPrompts
 *   are metadata identifiers only — they do not create, publish, or invoke anything
 */

export type WorkflowKey = string
export type WorkflowStageKey = string
export type WorkflowActionKey = string
export type WorkflowGuardKey = string

/**
 * Declarative stage kind for metadata / selectors.
 * Distinct from Case status (draft/intake/active/…).
 */
export type WorkflowStageKind = 'entry' | 'active' | 'blocked' | 'terminal'

/** Metadata-only color token for future UI (not applied in 4B.5). */
export type WorkflowStageColor =
  | 'neutral'
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'slate'

export type WorkflowStageDefinition = {
  key: WorkflowStageKey
  label: string
  description?: string
  kind: WorkflowStageKind
  /** Deterministic order within the workflow (0-based ascending). */
  order: number
  /** Metadata-only completion progress for this stage (0–100). */
  completionPercent: number
  /** Metadata-only estimated duration in days. */
  estimatedDurationDays?: number | null
  /** Metadata-only color token — not rendered in this sprint. */
  color?: WorkflowStageColor
  /** Document type keys expected at this stage (metadata only). */
  requiredDocuments?: readonly string[]
  /** Task type keys expected at this stage (metadata only). */
  requiredTasks?: readonly string[]
  /** Activity event keys suggested when entering this stage (metadata only). */
  suggestedActivities?: readonly string[]
  /** AI prompt / use-case keys suggested at this stage (metadata only). */
  suggestedAiPrompts?: readonly string[]
  /** Action keys that are conceptually allowed while on this stage. */
  allowedActions?: readonly WorkflowActionKey[]
}

export type WorkflowTransitionDefinition = {
  from: WorkflowStageKey
  to: WorkflowStageKey
  /** Optional action that names this transition. */
  actionKey?: WorkflowActionKey
  label?: string
  /** Declarative guard keys — not executed against a database. */
  guardKeys?: readonly WorkflowGuardKey[]
}

export type WorkflowReopenPolicy = {
  enabled: boolean
  fromStages: readonly WorkflowStageKey[]
  toStage: WorkflowStageKey
}

/**
 * Canonical Workflow definition (compiled catalog — not persisted).
 */
export type WorkflowDefinition = {
  workflowKey: WorkflowKey
  /** Exactly one workflow per Case Type in the foundation catalog. */
  caseType: string
  moduleKey: string
  displayName: string
  description: string
  entryStage: WorkflowStageKey
  terminalStages: readonly WorkflowStageKey[]
  blockedStages: readonly WorkflowStageKey[]
  reopen: WorkflowReopenPolicy
  stages: readonly WorkflowStageDefinition[]
  transitions: readonly WorkflowTransitionDefinition[]
  /** Optional overall estimated duration in days (metadata). */
  estimatedDurationDays?: number | null
}

/**
 * In-memory workflow instance draft.
 * Client-generated ids only — NOT a database-confirmed identity.
 * Not persisted; not a Case; advancing this draft never writes CRM rows.
 */
export type WorkflowInstanceDraft = {
  /**
   * Client-generated draft identifier for in-memory workflow shapes.
   * NOT a database workflow_run id — no workflow table exists yet.
   */
  id: string
  workflowKey: WorkflowKey
  caseType: string
  moduleKey: string
  /** Workflow process position — distinct from Case.status and Case.stage. */
  currentStage: WorkflowStageKey
  /** Soft link to a Case draft id (not a FK; no cases table required). */
  caseDraftId?: string | null
  openedAt: string
  /**
   * Draft-only closure timestamp when currentStage is terminal.
   * Does not persist a Case and does not set Case.closedAt.
   */
  closedAt?: string | null
  history: readonly WorkflowStageHistoryEntry[]
  metadata: WorkflowEngineMetadata
  isDraft: true
}

export type WorkflowStageHistoryEntry = {
  stage: WorkflowStageKey
  at: string
  actionKey?: WorkflowActionKey | null
}

export type WorkflowEngineMetadata = {
  source?: string
  idempotencyKey?: string
  notes?: string
  [key: string]: unknown
}

export type CreateWorkflowInstanceDraftInput = {
  workflowKey?: WorkflowKey
  caseType: string
  caseDraftId?: string | null
  currentStage?: WorkflowStageKey
  openedAt?: string
  metadata?: WorkflowEngineMetadata
  /** Optional client-generated draft id — never a DB workflow run id. */
  id?: string
}

export type WorkflowGuardContext = {
  /** Soft flags supplied by callers — no I/O performed by the engine. */
  flags?: Readonly<Record<string, boolean | undefined>>
}

export type WorkflowGuardResult =
  | { ok: true; guardKey: WorkflowGuardKey }
  | { ok: false; guardKey: WorkflowGuardKey; error: string }

export type WorkflowTransitionResult =
  | {
      ok: true
      from: WorkflowStageKey
      to: WorkflowStageKey
      actionKey?: WorkflowActionKey
    }
  | { ok: false; error: string }
