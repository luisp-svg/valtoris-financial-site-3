/**
 * Read-only current Pending for the Commission dashboard.
 * Counts only accepted_pending 040/041 facts. Never writes 035 or import RPCs.
 *
 * Current Pending for an application + writing allocation is the latest
 * accepted source fact for that pair by statement date, then source/created
 * order. Historical accepted rows are not summed.
 */
import type { AdvisorCompensationRow } from '../production/advisorCompensationView'
import { calendarDateInPeriod, type DashboardReportingPeriod } from '../production/dashboardPeriod'
import { formatProductionStageLabel } from '../production/labels'
import type { ProductionApplicationListItem } from '../production/types'
import {
  commissionClientLabel,
  commissionProductServiceLabel,
  commissionProviderLabel,
  commissionReferenceLabel,
} from './commissionPresentation'
import {
  commissionWorkItemId,
  deriveCommissionWorkStatus,
  type CommissionWorkItem,
  type CommissionWorkPendingSource,
} from './commissionWorkView'

export const COMMISSION_PENDING_NEEDS_REVIEW_STATUSES = [
  'review_duplicate_candidate',
  'review_policy_match',
  'review_advisor_match',
  'review_split_attribution',
] as const

export type AcceptedPendingSourceFact = {
  id: string
  batchId: string
  pendingReviewStatus: string
  applicationId: string
  allocationId: string
  advisorId: string
  sourceIncomeCents: number
  statementDate: string | null
  statementIdentifier: string | null
  sourceFile: string | null
  sourceCreatedAt: string | null
  createdAt: string
  transactionDate: string | null
  sourceWritingAssociate: string | null
  sourceClient: string | null
  sourcePolicyNumber: string | null
  sourceCompany: string | null
  sourceProduct: string | null
}

export type { CommissionWorkPendingSource }

export type CommissionAdvisorPendingRow = AdvisorCompensationRow & {
  pendingCents: number
}

export function pendingAllocationKey(applicationId: string, allocationId: string): string {
  return `${applicationId}:${allocationId}`
}

export function isCountableAcceptedPendingFact(fact: AcceptedPendingSourceFact): boolean {
  return (
    fact.pendingReviewStatus === 'accepted_pending' &&
    Boolean(fact.applicationId) &&
    Boolean(fact.allocationId) &&
    Boolean(fact.advisorId)
  )
}

function compareNullableChronology(left: string | null, right: string | null): number {
  const a = left ?? ''
  const b = right ?? ''
  if (a === b) return 0
  if (!a) return -1
  if (!b) return 1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Later statement / source / created_at / id is greater. Null dates lose. */
export function comparePendingStatementChronology(
  a: AcceptedPendingSourceFact,
  b: AcceptedPendingSourceFact,
): number {
  const byStatement = compareNullableChronology(a.statementDate, b.statementDate)
  if (byStatement !== 0) return byStatement
  const bySource = compareNullableChronology(a.sourceCreatedAt, b.sourceCreatedAt)
  if (bySource !== 0) return bySource
  const byCreated = compareNullableChronology(a.createdAt, b.createdAt)
  if (byCreated !== 0) return byCreated
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

export function pendingFactsInReportingPeriod(
  facts: readonly AcceptedPendingSourceFact[],
  period: DashboardReportingPeriod,
  today: string,
): AcceptedPendingSourceFact[] {
  return facts.filter(
    (fact) =>
      isCountableAcceptedPendingFact(fact) &&
      calendarDateInPeriod(fact.statementDate, period, today),
  )
}

/**
 * Latest accepted Pending fact per application + allocation, using only
 * facts whose statement date falls in the selected period.
 */
export function currentPendingFactsForPeriod(
  facts: readonly AcceptedPendingSourceFact[],
  period: DashboardReportingPeriod,
  today: string,
): AcceptedPendingSourceFact[] {
  const latest = new Map<string, AcceptedPendingSourceFact>()
  for (const fact of pendingFactsInReportingPeriod(facts, period, today)) {
    const key = pendingAllocationKey(fact.applicationId, fact.allocationId)
    const existing = latest.get(key)
    if (!existing || comparePendingStatementChronology(fact, existing) > 0) {
      latest.set(key, fact)
    }
  }
  return [...latest.values()]
}

export function sumCurrentPendingCents(facts: readonly AcceptedPendingSourceFact[]): number {
  return facts.reduce((sum, fact) => sum + fact.sourceIncomeCents, 0)
}

export function pendingCentsByAllocation(
  facts: readonly AcceptedPendingSourceFact[],
): Map<string, AcceptedPendingSourceFact> {
  const byKey = new Map<string, AcceptedPendingSourceFact>()
  for (const fact of facts) {
    byKey.set(pendingAllocationKey(fact.applicationId, fact.allocationId), fact)
  }
  return byKey
}

function advisorNameFromItems(
  advisorId: string,
  items: readonly ProductionApplicationListItem[],
  fallback: string | null,
): string {
  for (const item of items) {
    const expected = item.expected_compensations.find((row) => row.advisor_id === advisorId)
    if (expected?.advisor_display_name?.trim()) return expected.advisor_display_name.trim()
    const allocation = item.allocations.find(
      (row) => row.advisor_id === advisorId && row.effective_to == null,
    )
    if (allocation?.advisor?.display_name?.trim()) return allocation.advisor.display_name.trim()
  }
  return fallback?.trim() || 'Advisor'
}

export function overlayPendingOnAdvisorBreakdown(
  rows: readonly AdvisorCompensationRow[],
  currentFacts: readonly AcceptedPendingSourceFact[],
  items: readonly ProductionApplicationListItem[],
): CommissionAdvisorPendingRow[] {
  const pendingByAdvisor = new Map<string, number>()
  for (const fact of currentFacts) {
    pendingByAdvisor.set(
      fact.advisorId,
      (pendingByAdvisor.get(fact.advisorId) ?? 0) + fact.sourceIncomeCents,
    )
  }

  const seen = new Set<string>()
  const overlaid: CommissionAdvisorPendingRow[] = rows.map((row) => {
    if (row.advisorId) seen.add(row.advisorId)
    return {
      ...row,
      pendingCents: row.advisorId ? (pendingByAdvisor.get(row.advisorId) ?? 0) : 0,
    }
  })

  for (const [advisorId, pendingCents] of pendingByAdvisor) {
    if (seen.has(advisorId)) continue
    overlaid.push({
      advisorId,
      advisorName: advisorNameFromItems(advisorId, items, null),
      expectedCents: 0,
      outstandingCents: 0,
      paidCents: 0,
      chargebackCents: 0,
      netPaidCents: 0,
      reviewCount: 0,
      pendingCents,
    })
  }

  overlaid.sort((a, b) => {
    if (a.advisorId == null) return 1
    if (b.advisorId == null) return -1
    return a.advisorName.localeCompare(b.advisorName)
  })
  return overlaid
}

export function pendingSourceFromFact(
  fact: AcceptedPendingSourceFact,
  advisorName: string,
): CommissionWorkPendingSource {
  return {
    rowId: fact.id,
    batchId: fact.batchId,
    amountCents: fact.sourceIncomeCents,
    advisorName,
    client: fact.sourceClient,
    policyNumber: fact.sourcePolicyNumber,
    company: fact.sourceCompany,
    product: fact.sourceProduct,
    statementIdentifier: fact.statementIdentifier,
    statementDate: fact.statementDate,
    sourceFile: fact.sourceFile,
    transactionDate: fact.transactionDate,
  }
}

function withPending(
  item: CommissionWorkItem,
  fact: AcceptedPendingSourceFact | null,
): CommissionWorkItem {
  if (!fact) {
    return {
      ...item,
      pendingCents: 0,
      pendingPeriodDate: null,
      pendingSource: null,
    }
  }
  return {
    ...item,
    pendingCents: fact.sourceIncomeCents,
    pendingPeriodDate: fact.statementDate,
    pendingSource: pendingSourceFromFact(fact, item.advisorName),
  }
}

function stubWorkItemForPendingFact(
  item: ProductionApplicationListItem,
  fact: AcceptedPendingSourceFact,
): CommissionWorkItem {
  const advisorName = advisorNameFromItems(
    fact.advisorId,
    [item],
    fact.sourceWritingAssociate,
  )
  return {
    id: commissionWorkItemId(item.id, fact.allocationId, fact.advisorId),
    kind: 'writing_advisor',
    applicationId: item.id,
    allocationId: fact.allocationId,
    advisorId: fact.advisorId,
    advisorName,
    clientLabel: commissionClientLabel(item),
    referenceLabel: commissionReferenceLabel(item),
    providerLabel: commissionProviderLabel(item),
    providerId: item.carrier_id,
    productServiceLabel: commissionProductServiceLabel(item),
    productLine: item.product_line,
    productionStage: item.production_stage,
    productionStageLabel: formatProductionStageLabel(item.production_stage),
    expectedCents: null,
    outstandingCents: 0,
    pendingCents: fact.sourceIncomeCents,
    paidCents: 0,
    chargebackCents: 0,
    netPaidCents: 0,
    adjustmentCents: 0,
    recoveryCents: 0,
    eventCount: 0,
    lastFinancialActivity: null,
    expectedPeriodDate: item.submission_date ?? item.issue_date ?? null,
    pendingPeriodDate: fact.statementDate,
    pendingSource: pendingSourceFromFact(fact, advisorName),
    pendingOnlyStub: true,
    derivedStatus: deriveCommissionWorkStatus({
      expectedRow: null,
      totals: {
        expected_cents: null,
        gross_paid_cents: 0,
        adjustment_cents: 0,
        chargeback_cents: 0,
        recovery_cents: 0,
        net_actual_cents: 0,
        remaining_expected_cents: null,
        variance_cents: null,
      },
      eventCount: 0,
      outstandingCents: 0,
    }),
    reviewReason: null,
    expectedRow: null,
  }
}

/**
 * Attach current Pending to the exact application_id + allocation_id work
 * item. Does not change Outstanding, Paid, Chargebacks, or Net Paid.
 */
export function applyCommissionPendingToWorkItems(options: {
  items: readonly ProductionApplicationListItem[]
  workItems: readonly CommissionWorkItem[]
  currentFacts: readonly AcceptedPendingSourceFact[]
}): CommissionWorkItem[] {
  const byAllocation = pendingCentsByAllocation(options.currentFacts)
  const covered = new Set<string>()
  const next: CommissionWorkItem[] = options.workItems.map((item) => {
    if (!item.allocationId) return withPending(item, null)
    const key = pendingAllocationKey(item.applicationId, item.allocationId)
    const fact = byAllocation.get(key) ?? null
    if (fact) covered.add(key)
    return withPending(item, fact)
  })

  const itemsById = new Map(options.items.map((item) => [item.id, item]))
  for (const fact of options.currentFacts) {
    const key = pendingAllocationKey(fact.applicationId, fact.allocationId)
    if (covered.has(key)) continue
    const application = itemsById.get(fact.applicationId)
    if (!application) continue
    next.push(stubWorkItemForPendingFact(application, fact))
    covered.add(key)
  }

  next.sort((a, b) => {
    const client = a.clientLabel.localeCompare(b.clientLabel)
    if (client !== 0) return client
    const advisor = a.advisorName.localeCompare(b.advisorName)
    if (advisor !== 0) return advisor
    return a.id.localeCompare(b.id)
  })
  return next
}

export function formatPendingNeedsReviewCopy(count: number): string | null {
  if (count <= 0) return null
  return count === 1
    ? '1 pending-import row needs review'
    : `${count} pending-import rows need review`
}
