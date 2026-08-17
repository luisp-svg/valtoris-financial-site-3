/**
 * Phase A Production dashboard — client-side aggregation over the filtered
 * working set. Does not invent $0 in storage; NULL money is omitted from sums.
 */
import { presentEventReversal } from './compensationView'
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
  event_type: string
  amount_cents: number
  reversed_event_id: string | null
}

export type StageMoneyTotals = {
  caseCount: number
  lifePremiumCents: number
  annuityDepositCents: number
}

export type ProtectionMetric = {
  knownFaceCents: number
  unknownFaceCount: number
  inForceLifeCount: number
}

export type CommissionPaidMetric = {
  applicationCount: number
  paidCents: number
}

export type ProductionDashboardModel = {
  pipeline: Record<DashboardPipelineStage, StageMoneyTotals>
  summary: {
    lifePremiumCents: number
    annuityDepositCents: number
  }
  protection: ProtectionMetric
  commissionPaid: CommissionPaidMetric
}

const LIFE_LINES: ReadonlySet<ProductionProductLine> = new Set(['life_term', 'life_permanent'])

export function isLifeProductionLine(line: ProductionProductLine | string): boolean {
  return LIFE_LINES.has(line as ProductionProductLine)
}

export function isFiaProductionLine(line: ProductionProductLine | string): boolean {
  return line === 'fia'
}

export function emptyStageTotals(): StageMoneyTotals {
  return { caseCount: 0, lifePremiumCents: 0, annuityDepositCents: 0 }
}

export function emptyDashboardModel(): ProductionDashboardModel {
  return {
    pipeline: {
      submitted: emptyStageTotals(),
      paramed: emptyStageTotals(),
      in_underwriting: emptyStageTotals(),
      approved: emptyStageTotals(),
      sent_to_draft: emptyStageTotals(),
      premium_drafted: emptyStageTotals(),
    },
    summary: { lifePremiumCents: 0, annuityDepositCents: 0 },
    protection: { knownFaceCents: 0, unknownFaceCount: 0, inForceLifeCount: 0 },
    commissionPaid: { applicationCount: 0, paidCents: 0 },
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
    'product_line' | 'submitted_premium_cents' | 'annuity_deposit_cents' | 'face_amount_cents'
  >,
): void {
  totals.caseCount += 1
  if (isLifeProductionLine(item.product_line)) {
    totals.lifePremiumCents = addKnownCents(totals.lifePremiumCents, item.submitted_premium_cents)
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
    'product_line' | 'submitted_premium_cents' | 'annuity_deposit_cents' | 'face_amount_cents'
  >[],
): { lifePremiumCents: number; annuityDepositCents: number } {
  let lifePremiumCents = 0
  let annuityDepositCents = 0
  for (const item of items) {
    if (isLifeProductionLine(item.product_line)) {
      lifePremiumCents = addKnownCents(lifePremiumCents, item.submitted_premium_cents)
    }
    if (isFiaProductionLine(item.product_line)) {
      annuityDepositCents = addKnownCents(annuityDepositCents, item.annuity_deposit_cents)
    }
  }
  return { lifePremiumCents, annuityDepositCents }
}

export function computeActiveLifeProtection(
  items: readonly Pick<
    ProductionApplicationListItem,
    'product_line' | 'production_stage' | 'deleted_at' | 'face_amount_cents'
  >[],
): ProtectionMetric {
  let knownFaceCents = 0
  let unknownFaceCount = 0
  let inForceLifeCount = 0
  for (const item of items) {
    if (item.deleted_at != null) continue
    if (!isLifeProductionLine(item.product_line)) continue
    if (item.production_stage !== 'in_force') continue
    inForceLifeCount += 1
    if (item.face_amount_cents == null || Number.isNaN(item.face_amount_cents)) {
      unknownFaceCount += 1
    } else {
      knownFaceCents += item.face_amount_cents
    }
  }
  return { knownFaceCents, unknownFaceCount, inForceLifeCount }
}

export function aggregateActivePaidCommission(
  events: readonly PaidCommissionListEvent[],
  visibleApplicationIds: ReadonlySet<string>,
): CommissionPaidMetric {
  const scoped = events.filter((event) => visibleApplicationIds.has(event.application_id))
  const paidApps = new Set<string>()
  let paidCents = 0
  for (const event of scoped) {
    if (event.event_type !== 'paid') continue
    if (presentEventReversal(event, scoped).kind !== 'active') continue
    paidCents += event.amount_cents
    paidApps.add(event.application_id)
  }
  return { applicationCount: paidApps.size, paidCents }
}

export function buildProductionDashboard(
  items: readonly ProductionApplicationListItem[],
  paidEvents: readonly PaidCommissionListEvent[] = [],
): ProductionDashboardModel {
  const model = emptyDashboardModel()
  for (const item of items) {
    if (isDashboardPipelineStage(item.production_stage)) {
      addApplicationMoney(model.pipeline[item.production_stage], item)
    }
  }
  model.summary = summarizeLifeAndAnnuity(items)
  model.protection = computeActiveLifeProtection(items)
  model.commissionPaid = aggregateActivePaidCommission(
    paidEvents,
    new Set(items.map((item) => item.id)),
  )
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
