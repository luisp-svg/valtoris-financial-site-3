/**
 * Production dashboard — client-side aggregation over the filtered working set.
 * Life premium is annualized with Migration 034 premium_mode semantics.
 * Pipeline KPIs remain current-stage snapshots, optionally period-scoped by
 * submission_date. Active Life Protection period uses in_force_date.
 */
import { calendarDateInPeriod, type DashboardReportingPeriod } from './dashboardPeriod'
import { annualizeProductionPremium } from './premiumAnnualize'
import type { ProductionApplicationListItem, ProductionProductLine } from './types'

export const DASHBOARD_PIPELINE_STAGES = [
  'submitted',
  'paramed',
  'in_underwriting',
  'approved',
  'sent_to_draft',
  'premium_drafted',
] as const

export type DashboardPipelineStage = (typeof DASHBOARD_PIPELINE_STAGES)[number]

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
}

export type ProductionDashboardModel = {
  period: DashboardReportingPeriod
  pipeline: Record<DashboardPipelineStage, StageMoneyTotals>
  summary: {
    lifePremiumCents: number
    annuityDepositCents: number
    unannualizableLifeCount: number
  }
  protection: ProtectionMetric
}

const LIFE_LINES: ReadonlySet<ProductionProductLine> = new Set(['life_term', 'life_permanent'])

export function isLifeProductionLine(line: ProductionProductLine | string): boolean {
  return LIFE_LINES.has(line as ProductionProductLine)
}

export function isFiaProductionLine(line: ProductionProductLine | string): boolean {
  return line === 'fia'
}

export function emptyStageTotals(): StageMoneyTotals {
  return { caseCount: 0, lifePremiumCents: 0, annuityDepositCents: 0, unannualizableLifeCount: 0 }
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
    },
    summary: { lifePremiumCents: 0, annuityDepositCents: 0, unannualizableLifeCount: 0 },
    protection: { knownFaceCents: 0, unknownFaceCount: 0, inForceLifeCount: 0 },
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

export function isDashboardPipelineStage(stage: string): stage is DashboardPipelineStage {
  return (DASHBOARD_PIPELINE_STAGES as readonly string[]).includes(stage)
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

export function computeActiveLifeProtection(
  items: readonly Pick<
    ProductionApplicationListItem,
    'product_line' | 'production_stage' | 'deleted_at' | 'face_amount_cents' | 'in_force_date'
  >[],
  options: { period?: DashboardReportingPeriod; today?: string } = {},
): ProtectionMetric {
  const period = options.period ?? 'lifetime'
  const today = options.today ?? '9999-12-31'
  let knownFaceCents = 0
  let unknownFaceCount = 0
  let inForceLifeCount = 0
  for (const item of items) {
    if (item.deleted_at != null) continue
    if (!isLifeProductionLine(item.product_line)) continue
    if (item.production_stage !== 'in_force') continue
    if (period !== 'lifetime' && !calendarDateInPeriod(item.in_force_date, period, today)) {
      continue
    }
    inForceLifeCount += 1
    if (item.face_amount_cents == null || Number.isNaN(item.face_amount_cents)) {
      unknownFaceCount += 1
    } else {
      knownFaceCents += item.face_amount_cents
    }
  }
  return { knownFaceCents, unknownFaceCount, inForceLifeCount }
}

export function applicationsInProductionPeriod(
  items: readonly ProductionApplicationListItem[],
  period: DashboardReportingPeriod,
  today: string,
): ProductionApplicationListItem[] {
  if (period === 'lifetime') return [...items]
  return items.filter((item) => calendarDateInPeriod(item.submission_date, period, today))
}

export function buildProductionDashboard(
  items: readonly ProductionApplicationListItem[],
  options: { period?: DashboardReportingPeriod; today?: string } = {},
): ProductionDashboardModel {
  const period = options.period ?? 'lifetime'
  const today = options.today ?? '9999-12-31'
  const scoped = applicationsInProductionPeriod(items, period, today)
  const model = emptyDashboardModel(period)
  for (const item of scoped) {
    if (isDashboardPipelineStage(item.production_stage)) {
      addApplicationMoney(model.pipeline[item.production_stage], item)
    }
  }
  model.summary = summarizeLifeAndAnnuity(scoped)
  model.protection = computeActiveLifeProtection(items, { period, today })
  return model
}

export function pipelineStageLabel(stage: DashboardPipelineStage): string {
  if (stage === 'submitted') return 'Applied'
  if (stage === 'paramed') return 'Paramed'
  if (stage === 'in_underwriting') return 'In Underwriting'
  if (stage === 'approved') return 'Approved'
  if (stage === 'sent_to_draft') return 'Sent to Draft'
  return 'Drafted'
}
