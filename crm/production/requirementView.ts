/**
 * Case requirement view helpers. Catalog lives in requirementCatalog.ts.
 * Overdue detection is defined here for later Phase 2C reuse and must not be
 * wired into the Production queue, board, or Household Cases tab in Phase 2B.
 */

import type { ProductionProductLine, ProductionStage } from './types'
import {
  REQUIREMENT_CUSTOM_LABEL_MAX,
  REQUIREMENT_REOPEN_REASON_MAX,
  commonRequirementCodesForProductLine,
  formatRequirementCodeLabel,
  isRequirementCode,
  type RequirementCode,
  type RequirementStatus,
} from './requirementCatalog'
import type { RequirementHistoryRow, RequirementRow, RequirementUpdateFields } from './requirementTypes'

export const REQUIREMENT_STATUS_ACTIONS = [
  'schedule',
  'complete',
  'waive',
  'cancel',
  'return_to_open',
  'reopen',
] as const
export type RequirementStatusAction = (typeof REQUIREMENT_STATUS_ACTIONS)[number]

const ACTIONS_BY_STATUS: Record<RequirementStatus, readonly RequirementStatusAction[]> = {
  open: ['schedule', 'complete', 'waive', 'cancel'],
  scheduled: ['return_to_open', 'complete', 'waive', 'cancel'],
  complete: ['reopen'],
  waived: ['reopen'],
  cancelled: [],
}

export const REQUIREMENT_ACTION_LABELS: Record<RequirementStatusAction, string> = {
  schedule: 'Schedule',
  complete: 'Complete',
  waive: 'Waive',
  cancel: 'Cancel',
  return_to_open: 'Return to Open',
  reopen: 'Reopen',
}

export function requirementDisplayLabel(row: Pick<RequirementRow, 'requirement_code' | 'custom_label'>): string {
  if (row.requirement_code === 'other') {
    const label = row.custom_label?.trim()
    return label || formatRequirementCodeLabel('other')
  }
  return formatRequirementCodeLabel(row.requirement_code)
}

export function requirementStatusActions(status: RequirementStatus): RequirementStatusAction[] {
  return [...ACTIONS_BY_STATUS[status]]
}

export function canSoftDeleteRequirement(role: string | null): boolean {
  return role === 'owner'
}

export function canMutateRequirements(input: {
  stage: ProductionStage
  deletedAt: string | null
}): boolean {
  if (input.deletedAt) return false
  return input.stage !== 'draft' && input.stage !== 'pre_submitted'
}

export function normalizeRequirementLabel(value: string): string {
  return value.trim()
}

export function validateOtherLabel(value: string): string | null {
  const label = normalizeRequirementLabel(value)
  if (!label) return 'Enter a short operational label.'
  if (label.length > REQUIREMENT_CUSTOM_LABEL_MAX) {
    return `Keep the label to ${REQUIREMENT_CUSTOM_LABEL_MAX} characters or fewer.`
  }
  return null
}

export function validateReopenReason(value: string): string | null {
  const reason = value.trim()
  if (!reason) return 'Enter an operational reopen reason.'
  if (reason.length > REQUIREMENT_REOPEN_REASON_MAX) {
    return `Keep the reason to ${REQUIREMENT_REOPEN_REASON_MAX} characters or fewer.`
  }
  return null
}

export function validateScheduledFor(value: string): string | null {
  if (!value.trim()) return 'Choose a scheduled date.'
  return null
}

/**
 * Phase 2C overdue rule. Do not import this into queue/board/household UI yet.
 * Overdue = non-deleted, status open or scheduled, due_date < today.
 */
export function isOpenRequirementOverdue(
  row: Pick<RequirementRow, 'status' | 'due_date'> & { deleted_at?: string | null },
  today: string,
): boolean {
  if (row.deleted_at) return false
  if (row.status !== 'open' && row.status !== 'scheduled') return false
  if (!row.due_date) return false
  return row.due_date < today
}

export function previewCommonRequirements(
  productLine: ProductionProductLine,
  existing: readonly Pick<RequirementRow, 'requirement_code'>[],
): { toAdd: RequirementCode[]; skipped: RequirementCode[] } {
  const present = new Set(existing.map((row) => row.requirement_code))
  const toAdd: RequirementCode[] = []
  const skipped: RequirementCode[] = []
  for (const code of commonRequirementCodesForProductLine(productLine)) {
    if (present.has(code)) skipped.push(code)
    else toAdd.push(code)
  }
  return { toAdd, skipped }
}

export function buildRequirementUpdateFields(
  fields: RequirementUpdateFields,
): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (Object.prototype.hasOwnProperty.call(fields, 'due_date')) {
    out.due_date = fields.due_date ?? null
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'scheduled_for')) {
    out.scheduled_for = fields.scheduled_for ?? null
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'custom_label')) {
    out.custom_label = fields.custom_label ?? null
  }
  return out
}

export function historyVisibleForRequirement(
  history: readonly RequirementHistoryRow[],
  requirementId: string,
): RequirementHistoryRow[] {
  return history
    .filter((row) => row.requirement_id === requirementId)
    .filter((row) => row.reason !== 'soft_delete')
    .slice()
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

export function existingRequirementCodes(rows: readonly Pick<RequirementRow, 'requirement_code'>[]): Set<RequirementCode> {
  const codes = new Set<RequirementCode>()
  for (const row of rows) {
    if (isRequirementCode(row.requirement_code)) codes.add(row.requirement_code)
  }
  return codes
}
