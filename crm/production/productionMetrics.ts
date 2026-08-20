/**
 * Pure Production metric helpers shared by the dashboard and, later, Case views.
 * No store, no RPCs, no schema. Aggregates the already-loaded application list.
 */
import { calendarDateInPeriod, calendarDateOnly, type DashboardReportingPeriod } from './dashboardPeriod'
import type { ProductionProductLine, ProductionStage } from './types'

export const NEVER_SUBMITTED_STAGES = ['draft', 'pre_submitted'] as const

/** Current-stage operational pipeline. Issued is included; Applied is not a pipeline label. */
export const DASHBOARD_PIPELINE_STAGES = [
  'submitted',
  'paramed',
  'in_underwriting',
  'approved',
  'sent_to_draft',
  'premium_drafted',
  'issued',
] as const

export type DashboardPipelineStage = (typeof DASHBOARD_PIPELINE_STAGES)[number]

const LIFE_LINES: ReadonlySet<ProductionProductLine> = new Set(['life_term', 'life_permanent'])

const RESOLVED_UNSUCCESSFUL_STAGES = new Set<ProductionStage>([
  'declined',
  'not_taken',
  'withdrawn',
  'incomplete',
])

export function isLifeProductionLine(line: ProductionProductLine | string): boolean {
  return LIFE_LINES.has(line as ProductionProductLine)
}

export function isFiaProductionLine(line: ProductionProductLine | string): boolean {
  return line === 'fia'
}

export function isDashboardPipelineStage(stage: string): stage is DashboardPipelineStage {
  return (DASHBOARD_PIPELINE_STAGES as readonly string[]).includes(stage)
}

export function hasLegitimateSubmissionDate(value: string | null | undefined): boolean {
  return calendarDateOnly(value) != null
}

export function isNeverSubmittedStage(stage: string): boolean {
  return stage === 'draft' || stage === 'pre_submitted'
}

/** Legitimate submitted application — the Applied / funnel / pipeline cohort member. */
export function isLegitimateSubmittedApplication(item: {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
}): boolean {
  if (item.deleted_at != null) return false
  if (isNeverSubmittedStage(item.production_stage)) return false
  return hasLegitimateSubmissionDate(item.submission_date)
}

/** Submission-date cohort for Production Performance and Current Case Pipeline. */
export function applicationsInSubmittedCohort<T extends {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
}>(
  items: readonly T[],
  period: DashboardReportingPeriod,
  today: string,
): T[] {
  return items.filter((item) => {
    if (!isLegitimateSubmittedApplication(item)) return false
    if (period === 'lifetime') return true
    return calendarDateInPeriod(item.submission_date, period, today)
  })
}

export type LineFunnelCounts = {
  applied: number
  placed: number
  declined: number
  notTaken: number
  withdrawn: number
  incomplete: number
  postponed: number
  pending: number
}

export type LineFunnelMetrics = LineFunnelCounts & {
  grossPlacementRate: number | null
  resolvedPlacementRate: number | null
}

export type ProductionFunnelMetrics = {
  life: LineFunnelMetrics
  fia: LineFunnelMetrics
  all: LineFunnelMetrics
}

export function emptyLineFunnelCounts(): LineFunnelCounts {
  return {
    applied: 0,
    placed: 0,
    declined: 0,
    notTaken: 0,
    withdrawn: 0,
    incomplete: 0,
    postponed: 0,
    pending: 0,
  }
}

export function placementRatesFromCounts(counts: LineFunnelCounts): LineFunnelMetrics {
  const resolvedDenominator =
    counts.placed + counts.declined + counts.notTaken + counts.withdrawn + counts.incomplete
  return {
    ...counts,
    grossPlacementRate: counts.applied === 0 ? null : counts.placed / counts.applied,
    resolvedPlacementRate: resolvedDenominator === 0 ? null : counts.placed / resolvedDenominator,
  }
}

export function formatPlacementRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return 'N/A'
  return `${(rate * 100).toFixed(1)}%`
}

function addFunnelOutcome(counts: LineFunnelCounts, stage: string): void {
  counts.applied += 1
  if (stage === 'in_force') {
    counts.placed += 1
    return
  }
  if (stage === 'declined') {
    counts.declined += 1
    return
  }
  if (stage === 'not_taken') {
    counts.notTaken += 1
    return
  }
  if (stage === 'withdrawn') {
    counts.withdrawn += 1
    return
  }
  if (stage === 'incomplete') {
    counts.incomplete += 1
    return
  }
  if (stage === 'postponed') {
    counts.postponed += 1
    counts.pending += 1
    return
  }
  counts.pending += 1
}

function funnelFor(
  items: readonly { product_line: string; production_stage: string }[],
  line: 'life' | 'fia' | 'all',
): LineFunnelMetrics {
  const counts = emptyLineFunnelCounts()
  for (const item of items) {
    if (line === 'life' && !isLifeProductionLine(item.product_line)) continue
    if (line === 'fia' && !isFiaProductionLine(item.product_line)) continue
    addFunnelOutcome(counts, item.production_stage)
  }
  return placementRatesFromCounts(counts)
}

/** Caller must pass the submission-date cohort (already period-scoped). */
export function computeProductionFunnel(
  cohort: readonly { product_line: string; production_stage: string }[],
): ProductionFunnelMetrics {
  return {
    life: funnelFor(cohort, 'life'),
    fia: funnelFor(cohort, 'fia'),
    all: funnelFor(cohort, 'all'),
  }
}

export function pipelineStageLabel(stage: DashboardPipelineStage): string {
  if (stage === 'submitted') return 'Submitted'
  if (stage === 'paramed') return 'Paramed / Requirements'
  if (stage === 'in_underwriting') return 'In Underwriting'
  if (stage === 'approved') return 'Approved'
  if (stage === 'sent_to_draft') return 'Sent to Draft'
  if (stage === 'premium_drafted') return 'Premium Drafted'
  return 'Issued / Awaiting Placement'
}

export function isResolvedUnsuccessfulStage(stage: string): boolean {
  return RESOLVED_UNSUCCESSFUL_STAGES.has(stage as ProductionStage)
}
