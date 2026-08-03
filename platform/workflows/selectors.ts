/**
 * Workflow selectors and draft builders.
 * Pure / in-memory only — no database I/O and no workflow execution.
 */

import { getModule, listEnabledModules } from '../registry'
import {
  applyWorkflowClosure,
  getWorkflowCompletionPercent,
  getWorkflowStageDefinition,
  isWorkflowTerminalStage,
  listWorkflowStagesOrdered,
} from './lifecycle'
import { listAllowedWorkflowTransitions, transitionWorkflowStage } from './transitions'
import {
  getWorkflowDefinition,
  getWorkflowForCaseType,
  requireWorkflowForCaseType,
} from './workflowRegistry'
import type {
  CreateWorkflowInstanceDraftInput,
  WorkflowActionKey,
  WorkflowInstanceDraft,
  WorkflowKey,
  WorkflowStageDefinition,
  WorkflowStageKey,
} from './types'

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/** Client-generated draft id — never a DB-confirmed workflow run identity. */
function createDraftWorkflowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

function normalizeMetadata(
  input: CreateWorkflowInstanceDraftInput['metadata'] | undefined,
): WorkflowInstanceDraft['metadata'] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const metadata: WorkflowInstanceDraft['metadata'] = {}
  for (const key of ['source', 'idempotencyKey', 'notes'] as const) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      metadata[key] = value.trim()
    }
  }
  return metadata
}

export function validateCreateWorkflowInstanceDraftInput(
  input: CreateWorkflowInstanceDraftInput,
): { ok: true } | { ok: false; error: string } {
  const definition = input.workflowKey
    ? getWorkflowDefinition(input.workflowKey)
    : getWorkflowForCaseType(input.caseType)
  if (!definition) {
    return { ok: false, error: 'Unknown workflow for caseType / workflowKey' }
  }
  if (input.workflowKey && definition.workflowKey !== input.workflowKey) {
    return { ok: false, error: 'workflowKey does not match caseType' }
  }
  if (definition.caseType !== input.caseType) {
    return { ok: false, error: 'caseType does not match workflow definition' }
  }
  if (!getModule(definition.moduleKey)) {
    return { ok: false, error: 'Workflow moduleKey is not registered' }
  }
  if (input.caseDraftId != null && input.caseDraftId !== '') {
    if (!isUuid(input.caseDraftId)) {
      return { ok: false, error: 'caseDraftId must be a valid UUID when provided' }
    }
  }
  if (input.id != null && input.id !== '' && !isUuid(input.id)) {
    return { ok: false, error: 'id must be a valid UUID when provided' }
  }
  if (input.currentStage) {
    const stage = getWorkflowStageDefinition(definition.workflowKey, input.currentStage)
    if (!stage) {
      return { ok: false, error: `Unknown stage "${input.currentStage}" for workflow` }
    }
  }
  return { ok: true }
}

/**
 * Build an in-memory workflow instance draft.
 * Does not persist, execute transitions against a store, or create activities/tasks.
 */
export function createWorkflowInstanceDraft(
  input: CreateWorkflowInstanceDraftInput,
): WorkflowInstanceDraft {
  const validation = validateCreateWorkflowInstanceDraftInput(input)
  if (!validation.ok) {
    throw new Error(`Workflow Engine: ${validation.error}`)
  }

  const definition = requireWorkflowForCaseType(input.caseType)
  if (input.workflowKey && definition.workflowKey !== input.workflowKey) {
    throw new Error('Workflow Engine: workflowKey does not match caseType')
  }

  const openedAt = input.openedAt ?? new Date().toISOString()
  const currentStage = input.currentStage ?? definition.entryStage
  const closure = applyWorkflowClosure({
    workflowKey: definition.workflowKey,
    stage: currentStage,
    nowIso: openedAt,
  })

  return {
    id: input.id ?? createDraftWorkflowId(),
    workflowKey: definition.workflowKey,
    caseType: definition.caseType,
    moduleKey: definition.moduleKey,
    currentStage: closure.stage,
    caseDraftId: input.caseDraftId ?? null,
    openedAt,
    closedAt: closure.closedAt,
    history: [{ stage: currentStage, at: openedAt, actionKey: null }],
    metadata: normalizeMetadata(input.metadata),
    isDraft: true,
  }
}

/**
 * Apply a validated stage transition onto a draft instance (immutable).
 * Still non-persistent — returns a new draft object only.
 */
export function advanceWorkflowInstanceDraft(
  instance: WorkflowInstanceDraft,
  toStage: WorkflowStageKey,
  options: {
    actionKey?: WorkflowActionKey
    at?: string
    flags?: Readonly<Record<string, boolean | undefined>>
  } = {},
): WorkflowInstanceDraft {
  const result = transitionWorkflowStage(
    instance.workflowKey,
    instance.currentStage,
    toStage,
    { flags: options.flags },
  )
  if (!result.ok) {
    throw new Error(`Workflow Engine: ${result.error}`)
  }
  const at = options.at ?? new Date().toISOString()
  const closure = applyWorkflowClosure({
    workflowKey: instance.workflowKey,
    stage: toStage,
    nowIso: at,
  })
  return {
    ...instance,
    currentStage: closure.stage,
    closedAt: closure.closedAt,
    history: [
      ...instance.history,
      {
        stage: toStage,
        at,
        actionKey: options.actionKey ?? result.actionKey ?? null,
      },
    ],
  }
}

export function selectWorkflowStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): WorkflowStageDefinition | undefined {
  return getWorkflowStageDefinition(workflowKey, stage)
}

export function selectRequiredDocumentsForStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): string[] {
  return [...(getWorkflowStageDefinition(workflowKey, stage)?.requiredDocuments ?? [])]
}

export function selectRequiredTasksForStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): string[] {
  return [...(getWorkflowStageDefinition(workflowKey, stage)?.requiredTasks ?? [])]
}

export function selectSuggestedActivitiesForStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): string[] {
  return [...(getWorkflowStageDefinition(workflowKey, stage)?.suggestedActivities ?? [])]
}

export function selectSuggestedAiPromptsForStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): string[] {
  return [...(getWorkflowStageDefinition(workflowKey, stage)?.suggestedAiPrompts ?? [])]
}

export function selectAllowedActionsForStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): string[] {
  const stageActions = getWorkflowStageDefinition(workflowKey, stage)?.allowedActions ?? []
  const transitionActions = listAllowedWorkflowTransitions(workflowKey, stage)
    .map((item) => item.actionKey)
    .filter((item): item is string => Boolean(item))
  return [...new Set([...stageActions, ...transitionActions])].sort()
}

export function selectOpenWorkflowInstances(
  instances: readonly WorkflowInstanceDraft[],
): WorkflowInstanceDraft[] {
  return instances
    .filter((item) => !isWorkflowTerminalStage(item.workflowKey, item.currentStage))
    .slice()
    .sort((a, b) => {
      const byOpened = b.openedAt.localeCompare(a.openedAt)
      if (byOpened !== 0) return byOpened
      return a.id.localeCompare(b.id)
    })
}

export function selectWorkflowInstancesByCaseType(
  instances: readonly WorkflowInstanceDraft[],
  caseType: string,
): WorkflowInstanceDraft[] {
  return instances
    .filter((item) => item.caseType === caseType)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Instances whose module is currently feature-enabled.
 * Disabled product modules are excluded unless callers use unfiltered selectors.
 */
export function selectWorkflowInstancesForEnabledModules(
  instances: readonly WorkflowInstanceDraft[],
): WorkflowInstanceDraft[] {
  const enabled = new Set(listEnabledModules().map((module) => module.key))
  return instances
    .filter((item) => enabled.has(item.moduleKey))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function selectWorkflowProgress(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): { stage: WorkflowStageKey; completionPercent: number; stages: WorkflowStageDefinition[] } {
  return {
    stage,
    completionPercent: getWorkflowCompletionPercent(workflowKey, stage) ?? 0,
    stages: listWorkflowStagesOrdered(workflowKey),
  }
}
