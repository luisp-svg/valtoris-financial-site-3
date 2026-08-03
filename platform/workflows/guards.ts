/**
 * Declarative workflow guards — metadata evaluation only.
 * No database I/O, no permission engine, no automation side effects.
 */

import type {
  WorkflowGuardContext,
  WorkflowGuardKey,
  WorkflowGuardResult,
} from './types'

/**
 * Named guards referenced by transition definitions.
 * Evaluation uses caller-supplied flags only.
 */
export const WORKFLOW_GUARD_CATALOG = [
  {
    key: 'has_household',
    description: 'Case is linked to a household id.',
    flagKey: 'hasHousehold',
  },
  {
    key: 'has_assigned_advisor',
    description: 'An advisor is assigned to the engagement.',
    flagKey: 'hasAssignedAdvisor',
  },
  {
    key: 'documents_complete',
    description: 'Required documents for the current stage are present (caller asserts).',
    flagKey: 'documentsComplete',
  },
  {
    key: 'tasks_complete',
    description: 'Required tasks for the current stage are complete (caller asserts).',
    flagKey: 'tasksComplete',
  },
  {
    key: 'manual_approval',
    description: 'An advisor explicitly approved the transition.',
    flagKey: 'manualApproval',
  },
  {
    key: 'appointment_scheduled',
    description: 'An appointment exists for the engagement (caller asserts).',
    flagKey: 'appointmentScheduled',
  },
  {
    key: 'recommendation_ready',
    description: 'A recommendation artifact is ready (caller asserts).',
    flagKey: 'recommendationReady',
  },
] as const

const BY_KEY = new Map(WORKFLOW_GUARD_CATALOG.map((item) => [item.key, item]))

export function listWorkflowGuardKeys(): string[] {
  return WORKFLOW_GUARD_CATALOG.map((item) => item.key).sort()
}

export function isKnownWorkflowGuard(guardKey: string): boolean {
  return BY_KEY.has(guardKey as WorkflowGuardKey)
}

/**
 * Evaluate a single guard against caller-supplied context flags.
 * Missing / false flags fail closed. Unknown guard keys fail safely.
 */
export function evaluateWorkflowGuard(
  guardKey: WorkflowGuardKey,
  context: WorkflowGuardContext = {},
): WorkflowGuardResult {
  const definition = BY_KEY.get(guardKey)
  if (!definition) {
    return { ok: false, guardKey, error: `Unknown workflow guard "${guardKey}"` }
  }
  const flags = context.flags ?? {}
  if (flags[definition.flagKey] === true) {
    return { ok: true, guardKey }
  }
  return {
    ok: false,
    guardKey,
    error: `Guard "${guardKey}" not satisfied (flag "${definition.flagKey}" is not true)`,
  }
}

/**
 * Evaluate all guards for a transition. Empty guard list always passes.
 */
export function evaluateWorkflowGuards(
  guardKeys: readonly WorkflowGuardKey[] | undefined,
  context: WorkflowGuardContext = {},
): { ok: true } | { ok: false; error: string; failures: WorkflowGuardResult[] } {
  if (!guardKeys || guardKeys.length === 0) {
    return { ok: true }
  }
  const failures: WorkflowGuardResult[] = []
  for (const guardKey of guardKeys) {
    const result = evaluateWorkflowGuard(guardKey, context)
    if (!result.ok) failures.push(result)
  }
  if (failures.length === 0) return { ok: true }
  return {
    ok: false,
    error: failures
      .filter((item): item is Extract<WorkflowGuardResult, { ok: false }> => !item.ok)
      .map((item) => item.error)
      .join('; '),
    failures,
  }
}
