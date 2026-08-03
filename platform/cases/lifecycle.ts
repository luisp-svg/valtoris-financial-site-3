/**
 * Case status / stage lifecycle helpers.
 * Pure functions — no persistence.
 */

import { getCaseTypeDefinition } from './caseTypeRegistry'
import type { CaseStage, CaseStatus, CaseStatusTransition, CaseTypeKey } from './types'

/** Terminal statuses (no further open work expected). */
export const CASE_TERMINAL_STATUSES: readonly CaseStatus[] = [
  'completed',
  'cancelled',
  'archived',
] as const

/** Statuses that indicate the Case is still operationally open. */
export const CASE_OPEN_STATUSES: readonly CaseStatus[] = [
  'draft',
  'intake',
  'active',
  'waiting',
  'blocked',
] as const

/**
 * Allowed status transitions for the foundation state machine.
 * Module-specific stage moves are validated separately against case type stages.
 */
export const CASE_STATUS_TRANSITIONS: readonly CaseStatusTransition[] = [
  { from: 'draft', to: 'intake' },
  { from: 'draft', to: 'active' },
  { from: 'draft', to: 'cancelled' },
  { from: 'intake', to: 'active' },
  { from: 'intake', to: 'waiting' },
  { from: 'intake', to: 'blocked' },
  { from: 'intake', to: 'cancelled' },
  { from: 'active', to: 'waiting' },
  { from: 'active', to: 'blocked' },
  { from: 'active', to: 'completed' },
  { from: 'active', to: 'cancelled' },
  { from: 'waiting', to: 'active' },
  { from: 'waiting', to: 'blocked' },
  { from: 'waiting', to: 'cancelled' },
  { from: 'blocked', to: 'active' },
  { from: 'blocked', to: 'waiting' },
  { from: 'blocked', to: 'cancelled' },
  { from: 'completed', to: 'archived' },
  { from: 'cancelled', to: 'archived' },
  /** Reopen paths (limited). */
  { from: 'completed', to: 'active', reason: 'reopen' },
  { from: 'cancelled', to: 'intake', reason: 'reopen' },
] as const

export function isTerminalCaseStatus(status: CaseStatus): boolean {
  return (CASE_TERMINAL_STATUSES as readonly string[]).includes(status)
}

export function isOpenCaseStatus(status: CaseStatus): boolean {
  return (CASE_OPEN_STATUSES as readonly string[]).includes(status)
}

export function canTransitionCaseStatus(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return true
  return CASE_STATUS_TRANSITIONS.some(
    (transition) => transition.from === from && transition.to === to,
  )
}

export function assertCanTransitionCaseStatus(from: CaseStatus, to: CaseStatus): void {
  if (!canTransitionCaseStatus(from, to)) {
    throw new Error(`Case Engine: illegal status transition ${from} → ${to}`)
  }
}

export function transitionCaseStatus(
  from: CaseStatus,
  to: CaseStatus,
): { ok: true; status: CaseStatus } | { ok: false; error: string } {
  if (!canTransitionCaseStatus(from, to)) {
    return { ok: false, error: `Illegal status transition ${from} → ${to}` }
  }
  return { ok: true, status: to }
}

export function isValidStageForCaseType(caseType: CaseTypeKey, stage: CaseStage): boolean {
  const definition = getCaseTypeDefinition(caseType)
  if (!definition) return false
  return definition.stages.includes(stage)
}

export function canSetCaseStage(
  caseType: CaseTypeKey,
  stage: CaseStage,
): { ok: true } | { ok: false; error: string } {
  if (!isValidStageForCaseType(caseType, stage)) {
    return { ok: false, error: `Stage "${stage}" is not valid for caseType "${caseType}"` }
  }
  return { ok: true }
}

/**
 * Normalize closure timestamps for a status.
 * - Open statuses clear closedAt (does not touch openedAt).
 * - Terminal statuses require closedAt (preserve existing or set now).
 * completed and cancelled remain distinct statuses.
 */
export function applyCaseClosure(input: {
  status: CaseStatus
  closedAt?: string | null
  nowIso?: string
}): { status: CaseStatus; closedAt: string | null } {
  if (!isTerminalCaseStatus(input.status)) {
    return { status: input.status, closedAt: null }
  }
  return {
    status: input.status,
    closedAt: input.closedAt ?? input.nowIso ?? new Date().toISOString(),
  }
}

export function applyCaseReopen(
  input: { status: CaseStatus },
):
  | { ok: true; status: CaseStatus; closedAt: null }
  | { ok: false; error: string } {
  if (input.status === 'completed') {
    return { ok: true, status: 'active', closedAt: null }
  }
  if (input.status === 'cancelled') {
    return { ok: true, status: 'intake', closedAt: null }
  }
  if (input.status === 'archived') {
    return { ok: false, error: 'Archived cases cannot be reopened in v1' }
  }
  return { ok: false, error: `Cannot reopen from status ${input.status}` }
}
