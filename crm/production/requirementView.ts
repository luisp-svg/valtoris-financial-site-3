/**
 * Case requirement view helpers. Catalog lives in requirementCatalog.ts.
 * Overdue-requirement urgency lives only here — Case Detail, Production Case
 * views, Needs Attention, and Household Cases must reuse these helpers.
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
import type {
  RequirementHistoryRow,
  RequirementRow,
  RequirementUpdateFields,
  RequirementUrgencyRow,
} from './requirementTypes'

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

function calendarDay(value: string | null | undefined): string | null {
  if (!value) return null
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/** UTC calendar day (YYYY-MM-DD) used by the overdue-requirement rule. */
export function requirementCalendarToday(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Row-level overdue rule. Parent open-Case gating belongs in caseWorkspace.
 * Overdue = non-deleted, status open or scheduled, due_date < today.
 * scheduled_for is not an overdue trigger.
 */
export function isOpenRequirementOverdue(
  row: Pick<RequirementUrgencyRow, 'status' | 'due_date'> & { deleted_at?: string | null },
  today: string,
): boolean {
  if (row.deleted_at) return false
  if (row.status !== 'open' && row.status !== 'scheduled') return false
  const due = calendarDay(row.due_date)
  const todayDay = calendarDay(today)
  if (!due || !todayDay) return false
  return due < todayDay
}

export function countOverdueRequirements(
  rows: readonly (Pick<RequirementUrgencyRow, 'status' | 'due_date'> & { deleted_at?: string | null })[],
  today: string,
): number {
  let count = 0
  for (const row of rows) {
    if (isOpenRequirementOverdue(row, today)) count += 1
  }
  return count
}

export function overdueRequirementCountsByApplicationId(
  rows: readonly RequirementUrgencyRow[],
  today: string,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!isOpenRequirementOverdue(row, today)) continue
    counts.set(row.application_id, (counts.get(row.application_id) ?? 0) + 1)
  }
  return counts
}

export function applyOverdueRequirementCounts<T extends { id: string }>(
  items: readonly T[],
  counts: ReadonlyMap<string, number>,
): Array<T & { overdue_requirement_count: number }> {
  return items.map((item) => ({
    ...item,
    overdue_requirement_count: counts.get(item.id) ?? 0,
  }))
}

export function formatOverdueRequirementLabel(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return 'Overdue requirement'
  return `${count} overdue requirements`
}

export function isOutstandingRequirementStatus(status: RequirementStatus): boolean {
  return status === 'open' || status === 'scheduled'
}

export type RequirementPartition = {
  overdue: RequirementRow[]
  outstanding: RequirementRow[]
  completed: RequirementRow[]
}

/** Outstanding = open/scheduled and not overdue. Completed = complete/waived/cancelled. */
export function partitionRequirementRows(
  rows: readonly RequirementRow[],
  today: string,
): RequirementPartition {
  const overdue: RequirementRow[] = []
  const outstanding: RequirementRow[] = []
  const completed: RequirementRow[] = []
  for (const row of rows) {
    if (isOpenRequirementOverdue(row, today)) overdue.push(row)
    else if (isOutstandingRequirementStatus(row.status)) outstanding.push(row)
    else completed.push(row)
  }
  return { overdue, outstanding, completed }
}

function compareRequirementsByDueThenLabel(a: RequirementRow, b: RequirementRow): number {
  const aDue = calendarDay(a.due_date) ?? '9999-99-99'
  const bDue = calendarDay(b.due_date) ?? '9999-99-99'
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  return requirementDisplayLabel(a).localeCompare(requirementDisplayLabel(b))
}

export function pickBlockingRequirement(
  rows: readonly RequirementRow[],
  today: string,
): { row: RequirementRow; overdue: boolean } | null {
  const partitioned = partitionRequirementRows(rows, today)
  if (partitioned.overdue.length > 0) {
    const sorted = partitioned.overdue.slice().sort(compareRequirementsByDueThenLabel)
    return { row: sorted[0], overdue: true }
  }
  if (partitioned.outstanding.length > 0) {
    const sorted = partitioned.outstanding.slice().sort(compareRequirementsByDueThenLabel)
    return { row: sorted[0], overdue: false }
  }
  return null
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
