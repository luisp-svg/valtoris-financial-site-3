/**
 * Workflow lifecycle helpers — pure, non-executing.
 */

import { getWorkflowDefinition, requireWorkflowDefinition } from './workflowRegistry'
import type {
  WorkflowDefinition,
  WorkflowKey,
  WorkflowStageDefinition,
  WorkflowStageKey,
} from './types'

export function getWorkflowEntryStage(
  workflowKey: WorkflowKey,
): WorkflowStageKey | undefined {
  return getWorkflowDefinition(workflowKey)?.entryStage
}

export function isWorkflowTerminalStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): boolean {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) return false
  return definition.terminalStages.includes(stage)
}

export function isWorkflowBlockedStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): boolean {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) return false
  return definition.blockedStages.includes(stage)
}

export function isWorkflowEntryStage(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): boolean {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) return false
  return definition.entryStage === stage
}

export function getWorkflowStageDefinition(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): WorkflowStageDefinition | undefined {
  const definition = getWorkflowDefinition(workflowKey)
  return definition?.stages.find((item) => item.key === stage)
}

export function getWorkflowCompletionPercent(
  workflowKey: WorkflowKey,
  stage: WorkflowStageKey,
): number | undefined {
  return getWorkflowStageDefinition(workflowKey, stage)?.completionPercent
}

export function listWorkflowStagesOrdered(
  workflowKey: WorkflowKey,
): WorkflowStageDefinition[] {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) return []
  return definition.stages.slice().sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.key.localeCompare(b.key)
  })
}

export function canReopenWorkflow(
  workflowKey: WorkflowKey,
  fromStage: WorkflowStageKey,
): { ok: true; toStage: WorkflowStageKey } | { ok: false; error: string } {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) {
    return { ok: false, error: `Unknown workflowKey "${workflowKey}"` }
  }
  if (!definition.reopen.enabled) {
    return { ok: false, error: `Workflow "${workflowKey}" does not support reopen` }
  }
  if (!definition.reopen.fromStages.includes(fromStage)) {
    return {
      ok: false,
      error: `Stage "${fromStage}" cannot reopen for workflow "${workflowKey}"`,
    }
  }
  return { ok: true, toStage: definition.reopen.toStage }
}

/**
 * Apply closure timestamps for terminal stages (in-memory shape only).
 * Does not persist or clear unrelated fields.
 */
export function applyWorkflowClosure(input: {
  workflowKey: WorkflowKey
  stage: WorkflowStageKey
  closedAt?: string | null
  nowIso?: string
}): { stage: WorkflowStageKey; closedAt: string | null } {
  if (!isWorkflowTerminalStage(input.workflowKey, input.stage)) {
    return { stage: input.stage, closedAt: null }
  }
  return {
    stage: input.stage,
    closedAt: input.closedAt ?? input.nowIso ?? new Date().toISOString(),
  }
}

export function requireWorkflowStages(definition: WorkflowDefinition): void {
  requireWorkflowDefinition(definition.workflowKey)
}
