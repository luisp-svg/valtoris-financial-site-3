/**
 * Production dashboard — client-side aggregation over the filtered working set.
 * Life premium is annualized with Migration 034 premium_mode semantics.
 *
 * Production Performance (Applied, placement) uses the submission-date cohort.
 * Current Case Pipeline is current-stage within that same cohort.
 * Total Protection Placed period uses in_force_date.
 * Current Active Life Protection is the current book and is not period-filtered.
 */
import { calendarDateInPeriod, calendarDateOnly, type DashboardReportingPeriod } from './dashboardPeriod'
import { annualizeProductionPremium } from './premiumAnnualize'
import {
  isCurrentlyActiveLinkedPolicy,
  isPlacedApplication,
} from './policyLifecycle'
import {
  applicationsInSubmittedCohort,
  computeProductionFunnel,
  emptyLineFunnelCounts,
  isDashboardPipelineStage,
  isFiaProductionLine,
  isLifeProductionLine,
  placementRatesFromCounts,
  type DashboardPipelineStage,
  type ProductionFunnelMetrics,
} from './productionMetrics'
import type { ProductionApplicationListItem } from './types'

export {
  applicationsInSubmittedCohort,
  computeProductionFunnel,
  DASHBOARD_PIPELINE_STAGES,
  formatPlacementRate,
  isDashboardPipelineStage,
  isFiaProductionLine,
  isLegitimateSubmittedApplication,
  isLifeProductionLine,
  pipelineStageLabel,
} from './productionMetrics'
export type { DashboardPipelineStage, LineFunnelMetrics, ProductionFunnelMetrics } from './productionMetrics'

export type PaidCommissionListEvent = {
  id: string
  application_id: string
  advisor_id: string | null
  allocation_id: string | null
  event_type: string
  amount_cents: number
  reversed_event_id: string | null
  transaction_date: string | null
}

export type StageMoneyTotals = {
  caseCount: number
  lifePremiumCents: number
  annuityDepositCents: number
  unannualizableLifeCount: number
}

export type ProtectionMetric = {
  knownFaceCents: number
  unknownFaceCount: number
  inForceLifeCount: number
  /** In-force life with no usable in-force date. Counted in Lifetime; omitted from YTD/Month. */
  missingInForceDateCount: number
}

export type ProductionDashboardModel = {
  period: DashboardReportingPeriod
  pipeline: Record<DashboardPipelineStage, StageMoneyTotals>
  summary: {
    lifePremiumCents: number
    annuityDepositCents: number
    unannualizableLifeCount: number
  }
  /** Historical life face that reached in force. Period uses in_force_date. */
  placedProtection: ProtectionMetric
  /** Current book: placed life whose linked policy is still in_force. Not period-filtered. */
  activeProtection: ProtectionMetric
  funnel: ProductionFunnelMetrics
}

export function emptyStageTotals(): StageMoneyTotals {
  return { caseCount: 0, lifePremiumCents: 0, annuityDepositCents: 0, unannualizableLifeCount: 0 }
}

function emptyFunnel(): ProductionFunnelMetrics {
  const empty = placementRatesFromCounts(emptyLineFunnelCounts())
  return { life: empty, fia: empty, all: empty }
}

function emptyProtection(): ProtectionMetric {
  return {
    knownFaceCents: 0,
    unknownFaceCount: 0,
    inForceLifeCount: 0,
    missingInForceDateCount: 0,
  }
}

export function emptyDashboardModel(
  period: DashboardReportingPeriod = 'lifetime',
): ProductionDashboardModel {
  return {
    period,
    pipeline: {
      submitted: emptyStageTotals(),
      paramed: emptyStageTotals(),
      in_underwriting: emptyStageTotals(),
      approved: emptyStageTotals(),
      sent_to_draft: emptyStageTotals(),
      premium_drafted: emptyStageTotals(),
      issued: emptyStageTotals(),
    },
    summary: { lifePremiumCents: 0, annuityDepositCents: 0, unannualizableLifeCount: 0 },
    placedProtection: emptyProtection(),
    activeProtection: emptyProtection(),
    funnel: emptyFunnel(),
  }
}

function addKnownCents(total: number, value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return total
  return total + value
}

function addApplicationMoney(
  totals: StageMoneyTotals,
  item: Pick<
    ProductionApplicationListItem,
    | 'product_line'
    | 'submitted_premium_cents'
    | 'annuity_deposit_cents'
    | 'face_amount_cents'
    | 'premium_mode'
  >,
): void {
  totals.caseCount += 1
  if (isLifeProductionLine(item.product_line)) {
    const annual = annualizeProductionPremium(item.submitted_premium_cents, item.premium_mode)
    if (annual == null) {
      if (item.submitted_premium_cents != null) totals.unannualizableLifeCount += 1
    } else {
      totals.lifePremiumCents = addKnownCents(totals.lifePremiumCents, annual)
    }
  }
  if (isFiaProductionLine(item.product_line)) {
    totals.annuityDepositCents = addKnownCents(totals.annuityDepositCents, item.annuity_deposit_cents)
  }
}

export function summarizeLifeAndAnnuity(
  items: readonly Pick<
    ProductionApplicationListItem,
    | 'product_line'
    | 'submitted_premium_cents'
    | 'annuity_deposit_cents'
    | 'face_amount_cents'
    | 'premium_mode'
  >[],
): { lifePremiumCents: number; annuityDepositCents: number; unannualizableLifeCount: number } {
  let lifePremiumCents = 0
  let annuityDepositCents = 0
  let unannualizableLifeCount = 0
  for (const item of items) {
    if (isLifeProductionLine(item.product_line)) {
      const annual = annualizeProductionPremium(item.submitted_premium_cents, item.premium_mode)
      if (annual == null) {
        if (item.submitted_premium_cents != null) unannualizableLifeCount += 1
      } else {
        lifePremiumCents = addKnownCents(lifePremiumCents, annual)
      }
    }
    if (isFiaProductionLine(item.product_line)) {
      annuityDepositCents = addKnownCents(annuityDepositCents, item.annuity_deposit_cents)
    }
  }
  return { lifePremiumCents, annuityDepositCents, unannualizableLifeCount }
}

function addLifeFace(metric: ProtectionMetric, faceAmountCents: number | null | undefined): void {
  metric.inForceLifeCount += 1
  if (faceAmountCents == null || Number.isNaN(faceAmountCents)) {
    metric.unknownFaceCount += 1
  } else {
    metric.knownFaceCents += faceAmountCents
  }
}

/**
 * Historical life face successfully placed by Valtoris.
 * Source: production_stage === in_force. Later canceled/surrendered remain included.
 * Period uses application in_force_date.
 */
export function computePlacedLifeProtection(
  items: readonly Pick<
    ProductionApplicationListItem,
    'product_line' | 'production_stage' | 'deleted_at' | 'face_amount_cents' | 'in_force_date'
  >[],
  options: { period?: DashboardReportingPeriod; today?: string } = {},
): ProtectionMetric {
  const period = options.period ?? 'lifetime'
  const today = options.today ?? '9999-12-31'
  const metric = emptyProtection()
  for (const item of items) {
    if (item.deleted_at != null) continue
    if (!isLifeProductionLine(item.product_line)) continue
    if (item.production_stage !== 'in_force') continue
    if (!calendarDateOnly(item.in_force_date)) {
      metric.missingInForceDateCount += 1
    }
    if (period !== 'lifetime' && !calendarDateInPeriod(item.in_force_date, period, today)) {
      continue
    }
    addLifeFace(metric, item.face_amount_cents)
  }
  return metric
}

/** @deprecated Use computePlacedLifeProtection. Kept for call-site clarity during the split. */
export function computeActiveLifeProtection(
  items: readonly Pick<
    ProductionApplicationListItem,
    'product_line' | 'production_stage' | 'deleted_at' | 'face_amount_cents' | 'in_force_date'
  >[],
  options: { period?: DashboardReportingPeriod; today?: string } = {},
): ProtectionMetric {
  return computePlacedLifeProtection(items, options)
}

/**
 * Face amount currently protecting clients.
 * Source: placed life application AND linked policy status === in_force.
 * Current book today — not period-filtered.
 */
export function computeCurrentActiveLifeProtection(
  items: readonly Pick<
    ProductionApplicationListItem,
    | 'product_line'
    | 'production_stage'
    | 'deleted_at'
    | 'face_amount_cents'
    | 'linked_policies'
  >[],
): ProtectionMetric {
  const metric = emptyProtection()
  for (const item of items) {
    if (!isLifeProductionLine(item.product_line)) continue
    if (!isPlacedApplication(item)) continue
    if (!isCurrentlyActiveLinkedPolicy(item)) continue
    addLifeFace(metric, item.face_amount_cents)
  }
  return metric
}

export function buildProductionDashboard(
  items: readonly ProductionApplicationListItem[],
  options: { period?: DashboardReportingPeriod; today?: string } = {},
): ProductionDashboardModel {
  const period = options.period ?? 'lifetime'
  const today = options.today ?? '9999-12-31'
  const cohort = applicationsInSubmittedCohort(items, period, today)
  const model = emptyDashboardModel(period)
  for (const item of cohort) {
    if (isDashboardPipelineStage(item.production_stage)) {
      addApplicationMoney(model.pipeline[item.production_stage], item)
    }
  }
  model.summary = summarizeLifeAndAnnuity(cohort)
  model.placedProtection = computePlacedLifeProtection(items, { period, today })
  model.activeProtection = computeCurrentActiveLifeProtection(items)
  model.funnel = computeProductionFunnel(cohort)
  return model
}
