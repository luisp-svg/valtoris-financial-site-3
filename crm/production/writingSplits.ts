/**
 * Writing-advisor split helpers for Policy Production create/edit.
 * UI displays percentages; the RPC payload uses integer basis points.
 * The server remains authoritative for 10,000 bps totals.
 */

import { PRODUCTION_ENTRY_WRITING_BPS_TOTAL } from './types'
import type { ProductionAdvisorOption, ProductionAllocationDraft } from './types'

export const WRITING_SPLIT_PERCENT_TOTAL = 100

export type WritingAllocationRpcPayload = {
  recipient_type: 'advisor'
  advisor_id: string
  allocation_role: 'writing'
  commission_bps: number
  production_credit_bps: number
}

export function writingPercentToBps(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.round(percent * 100)
}

export function writingBpsToPercent(bps: number): number {
  if (!Number.isFinite(bps)) return 0
  return Number(bps) / 100
}

export function formatWritingPercent(bps: number): string {
  const percent = writingBpsToPercent(bps)
  const text = Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)))
  return `${text}%`
}

export function writingBpsToPercentInput(bps: number): string {
  const percent = writingBpsToPercent(bps)
  if (!Number.isFinite(percent)) return ''
  return Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)))
}

export function parseWritingPercentInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null
  return Number(trimmed)
}

export function allocationsFromPercentSplit(
  advisorIds: string[],
  percents: number[],
): ProductionAllocationDraft[] {
  return advisorIds.map((id, index) => {
    const bps = writingPercentToBps(percents[index] ?? 0)
    return {
      recipient_type: 'advisor' as const,
      advisor_id: id,
      allocation_role: 'writing' as const,
      commission_bps: bps,
      production_credit_bps: bps,
    }
  })
}

export function patchWritingPercent(
  row: ProductionAllocationDraft,
  percentRaw: string,
): ProductionAllocationDraft {
  const parsed = parseWritingPercentInput(percentRaw)
  const bps = parsed == null ? Number(row.commission_bps || 0) : writingPercentToBps(parsed)
  return {
    recipient_type: 'advisor',
    advisor_id: row.advisor_id,
    allocation_role: 'writing',
    commission_bps: bps,
    production_credit_bps: bps,
  }
}

export function writingSplitAllocatedBps(rows: ProductionAllocationDraft[]): number {
  return rows.reduce((sum, row) => sum + Number(row.commission_bps || 0), 0)
}

export function writingSplitSummary(rows: ProductionAllocationDraft[]): {
  allocatedBps: number
  remainingBps: number
  allocatedPercent: number
  remainingPercent: number
} {
  const allocatedBps = writingSplitAllocatedBps(rows)
  const remainingBps = PRODUCTION_ENTRY_WRITING_BPS_TOTAL - allocatedBps
  return {
    allocatedBps,
    remainingBps,
    allocatedPercent: writingBpsToPercent(allocatedBps),
    remainingPercent: writingBpsToPercent(remainingBps),
  }
}

export function writingSplitError(rows: ProductionAllocationDraft[]): string | undefined {
  if (rows.length === 0 || rows.some((row) => !row.advisor_id?.trim())) {
    return 'Select at least one writing advisor.'
  }
  const advisorIds = rows.map((row) => row.advisor_id)
  if (new Set(advisorIds).size !== advisorIds.length) {
    return 'Each writing advisor can appear only once.'
  }
  for (const row of rows) {
    if (row.recipient_type !== 'advisor' || row.allocation_role !== 'writing') {
      return 'Writing advisors can only include writing advisor allocations.'
    }
    const commission = Number(row.commission_bps)
    if (!Number.isFinite(commission) || commission < 0) {
      return 'Writing allocation cannot be negative.'
    }
    if (commission === 0) return 'Writing allocation cannot be 0%.'
    if (commission > PRODUCTION_ENTRY_WRITING_BPS_TOTAL) {
      return 'Writing allocations must total 100%.'
    }
  }
  const commissionTotal = writingSplitAllocatedBps(rows)
  const creditTotal = rows.reduce((sum, row) => sum + Number(row.production_credit_bps || 0), 0)
  if (commissionTotal !== PRODUCTION_ENTRY_WRITING_BPS_TOTAL || creditTotal !== PRODUCTION_ENTRY_WRITING_BPS_TOTAL) {
    return 'Writing allocations must total 100%.'
  }
  return undefined
}

/** Client payload for set_policy_application_allocations. Extra keys are never sent. */
export function toWritingAllocationRpcPayload(
  rows: ProductionAllocationDraft[],
): WritingAllocationRpcPayload[] {
  return rows.map((row) => ({
    recipient_type: 'advisor',
    advisor_id: String(row.advisor_id),
    allocation_role: 'writing',
    commission_bps: Number(row.commission_bps),
    production_credit_bps: Number(row.production_credit_bps),
  }))
}

export function allocationPayloadHasForbiddenKeys(payload: unknown): boolean {
  if (!Array.isArray(payload)) return true
  const forbidden = [
    'writing_contract_level',
    'contract_level',
    'compensation_rate',
    'writing_rate',
    'expected_commission',
    'expected_compensation_cents',
    'compensation_schedule_id',
  ]
  return payload.some((row) => {
    if (!row || typeof row !== 'object') return true
    return forbidden.some((key) => key in (row as Record<string, unknown>))
  })
}

export function advisorLicensingWarning(
  advisor: ProductionAdvisorOption | undefined,
  state: string,
): string | null {
  if (!advisor || !state.trim()) return null
  const licensed = advisor.states_licensed
  if (!licensed || licensed.length === 0) return null
  const code = state.trim().toUpperCase()
  if (licensed.some((value) => value.trim().toUpperCase() === code)) return null
  return `${advisor.display_name} is not listed as licensed in ${code}. This does not block saving.`
}

export function emptyWritingAdvisorRow(advisorId = ''): ProductionAllocationDraft {
  return {
    recipient_type: 'advisor',
    advisor_id: advisorId,
    allocation_role: 'writing',
    commission_bps: 0,
    production_credit_bps: 0,
  }
}
