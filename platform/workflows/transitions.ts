/**
 * Workflow transition helpers — declarative validation only.
 * Does not mutate Case/Task/Document stores and does not run automations.
 */

import { evaluateWorkflowGuards } from './guards'
import { getWorkflowDefinition } from './workflowRegistry'
import type {
  WorkflowGuardContext,
  WorkflowKey,
  WorkflowStageKey,
  WorkflowTransitionDefinition,
  WorkflowTransitionResult,
} from './types'

export function listWorkflowTransitions(
  workflowKey: WorkflowKey,
): readonly WorkflowTransitionDefinition[] {
  return getWorkflowDefinition(workflowKey)?.transitions ?? []
}

export function listAllowedWorkflowTransitions(
  workflowKey: WorkflowKey,
  fromStage: WorkflowStageKey,
): WorkflowTransitionDefinition[] {
  return listWorkflowTransitions(workflowKey).filter((item) => item.from === fromStage)
}

export function canTransitionWorkflowStage(
  workflowKey: WorkflowKey,
  from: WorkflowStageKey,
  to: WorkflowStageKey,
): boolean {
  if (from === to) return true
  return listWorkflowTransitions(workflowKey).some(
    (item) => item.from === from && item.to === to,
  )
}

export function findWorkflowTransition(
  workflowKey: WorkflowKey,
  from: WorkflowStageKey,
  to: WorkflowStageKey,
): WorkflowTransitionDefinition | undefined {
  return listWorkflowTransitions(workflowKey).find(
    (item) => item.from === from && item.to === to,
  )
}

/**
 * Validate a stage transition (and optional guards against caller flags).
 * Pure — does not advance any persisted state.
 */
export function transitionWorkflowStage(
  workflowKey: WorkflowKey,
  from: WorkflowStageKey,
  to: WorkflowStageKey,
  context: WorkflowGuardContext = {},
): WorkflowTransitionResult {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) {
    return { ok: false, error: `Unknown workflowKey "${workflowKey}"` }
  }
  if (from === to) {
    return { ok: true, from, to }
  }
  const transition = findWorkflowTransition(workflowKey, from, to)
  if (!transition) {
    return {
      ok: false,
      error: `Illegal workflow transition ${from} → ${to} for "${workflowKey}"`,
    }
  }
  const guards = evaluateWorkflowGuards(transition.guardKeys, context)
  if (!guards.ok) {
    return { ok: false, error: guards.error }
  }
  return {
    ok: true,
    from,
    to,
    actionKey: transition.actionKey,
  }
}

export function assertCanTransitionWorkflowStage(
  workflowKey: WorkflowKey,
  from: WorkflowStageKey,
  to: WorkflowStageKey,
  context: WorkflowGuardContext = {},
): void {
  const result = transitionWorkflowStage(workflowKey, from, to, context)
  if (!result.ok) {
    throw new Error(`Workflow Engine: ${result.error}`)
  }
}
