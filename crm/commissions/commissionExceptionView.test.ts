import { describe, expect, it } from 'vitest'
import {
  FAILED_PRODUCTION_STAGES,
  INTAKE_PRODUCTION_STAGES,
  isOutstandingProductionStage,
} from '../production/advisorCompensationView'
import { deriveActualStatus } from '../production/compensationView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
  ProductionStage,
} from '../production/types'
import {
  COMMISSION_EXCEPTION_BUCKETS,
  PENDING_WITHOUT_ACTUAL_COPY,
  commissionExceptionFlags,
  commissionExceptionNotes,
  formatCommissionReconciliationLabel,
  isReconciledDisplay,
  varianceCentsForWorkItem,
  visibleExceptionBuckets,
  workItemMatchesExceptionBucket,
} from './commissionExceptionView'
import { defaultCommissionQueueFilters, filterCommissionWorkItems } from './commissionFilters'
import {
  buildCommissionWorkItems,
  deriveCommissionWorkStatus,
  formatCommissionWorkStatusLabel,
  type CommissionWorkItem,
  type CommissionWorkPendingSource,
} from './commissionWorkView'

function expectedRow(
  partial: Partial<LiveExpectedCompensationRow> &
    Pick<LiveExpectedCompensationRow, 'id' | 'advisor_id' | 'application_id'>,
): LiveExpectedCompensationRow {
  return {
    allocation_id: `alloc-${partial.id}`,
    advisor_display_name: 'Alex Advisor',
    writing_contract_level: 'FA',
    writing_rate: '0.01',
    compensation_base_cents: 1000000,
    commission_bps: 10000,
    expected_compensation_cents: 100000,
    calculation_status: 'resolved',
    review_reason: null,
    calculated_at: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function application(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage'>,
): ProductionApplicationListItem {
  return {
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'APP-1',
    policy_number: 'POL-1',
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-08-05',
    next_follow_up_date: null,
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: null,
    premium_mode: 'annual',
    issue_date: null,
    in_force_date: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    writing_receivable_expected: true,
    ...partial,
  }
}

function pendingSource(
  partial: Partial<CommissionWorkPendingSource> = {},
): CommissionWorkPendingSource {
  return {
    rowId: 'pending-row-1',
    batchId: 'batch-1',
    amountCents: 80000,
    advisorName: 'Alex Advisor',
    client: 'Rivera',
    policyNumber: 'POL-1',
    company: 'Acme',
    product: 'Term 20',
    statementIdentifier: 'experior-pending:A1',
    statementDate: '2026-08-17',
    sourceFile: 'pending.csv',
    transactionDate: '2026-08-16',
    carrierId: 'c1',
    sourceRow: 1,
    ...partial,
  }
}

function item(
  partial: Partial<CommissionWorkItem> & Pick<CommissionWorkItem, 'id' | 'applicationId'>,
): CommissionWorkItem {
  return {
    kind: 'writing_advisor',
    allocationId: 'alloc-a',
    advisorId: 'adv-a',
    advisorName: 'Alex Advisor',
    clientLabel: 'Rivera',
    referenceLabel: 'POL-1',
    providerLabel: 'Acme Life',
    providerId: 'c1',
    productServiceLabel: 'Term 20',
    productLine: 'life_term',
    productionStage: 'issued',
    productionStageLabel: 'Issued',
    expectedCents: 100000,
    outstandingCents: 100000,
    remainingExpectedCents: 100000,
    pendingCents: 0,
    paidCents: 0,
    chargebackCents: 0,
    netPaidCents: 0,
    adjustmentCents: 0,
    recoveryCents: 0,
    eventCount: 0,
    lastFinancialActivity: null,
    expectedPeriodDate: '2026-08-05',
    pendingPeriodDate: null,
    pendingSource: null,
    pendingOnlyStub: false,
    derivedStatus: { primary: 'outstanding', chargedBack: false, needsReview: false },
    reviewReason: null,
    expectedRow: null,
    ...partial,
  }
}

const TODAY = '2026-08-16'

describe('commission exception derived states', () => {
  it('does not invent Eligible, Released, stale outstanding, or a persisted reconciled flag', () => {
    expect(COMMISSION_EXCEPTION_BUCKETS).toEqual([
      'all',
      'outstanding',
      'reconciled',
      'overpaid',
      'chargeback_activity',
      'expected_unavailable',
      'attribution_review',
      'pending_without_actual',
    ])
    expect(COMMISSION_EXCEPTION_BUCKETS.join(' ')).not.toMatch(/eligible|released|stale/i)
    expect(formatCommissionWorkStatusLabel('paid')).toBe('Paid')
  })

  it('uses the existing lifecycle-aware outstanding formula', () => {
    const expected = expectedRow({
      id: 'e1',
      application_id: 'app-1',
      advisor_id: 'adv-a',
      allocation_id: 'alloc-e1',
      expected_compensation_cents: 100000,
    })
    const issued = buildCommissionWorkItems({
      items: [
        application({
          id: 'app-1',
          production_stage: 'issued',
          expected_compensations: [expected],
        }),
      ],
      events: [],
    })[0]
    expect(issued?.outstandingCents).toBe(100000)
    expect(commissionExceptionFlags(issued!, true).outstanding).toBe(true)
    expect(isOutstandingProductionStage('issued')).toBe(true)

    for (const stage of [...FAILED_PRODUCTION_STAGES, ...INTAKE_PRODUCTION_STAGES] as ProductionStage[]) {
      const row = buildCommissionWorkItems({
        items: [
          application({
            id: `app-${stage}`,
            production_stage: stage,
            expected_compensations: [
              expectedRow({
                id: `e-${stage}`,
                application_id: `app-${stage}`,
                advisor_id: 'adv-a',
                allocation_id: `alloc-${stage}`,
                expected_compensation_cents: 100000,
              }),
            ],
          }),
        ],
        events: [],
      })[0]
      expect(isOutstandingProductionStage(stage)).toBe(false)
      expect(row?.outstandingCents).toBe(0)
      expect(commissionExceptionFlags(row!, true).outstanding).toBe(false)
    }
  })

  it('treats Reconciled as a display alias for known Expected and remaining 0', () => {
    const reconciled = item({
      id: 'rec',
      applicationId: 'app-1',
      outstandingCents: 0,
      remainingExpectedCents: 0,
      paidCents: 100000,
      netPaidCents: 100000,
      eventCount: 1,
      derivedStatus: { primary: 'paid', chargedBack: false, needsReview: false },
    })
    expect(isReconciledDisplay(reconciled)).toBe(true)
    expect(formatCommissionReconciliationLabel(reconciled)).toBe('Reconciled')
    expect(deriveCommissionWorkStatus({
      expectedRow: expectedRow({
        id: 'e1',
        application_id: 'app-1',
        advisor_id: 'adv-a',
        expected_compensation_cents: 100000,
      }),
      totals: {
        expected_cents: 100000,
        gross_paid_cents: 100000,
        adjustment_cents: 0,
        chargeback_cents: 0,
        recovery_cents: 0,
        net_actual_cents: 100000,
        remaining_expected_cents: 0,
        variance_cents: 0,
      },
      eventCount: 1,
      outstandingCents: 0,
    }).primary).toBe('paid')
    expect(
      deriveActualStatus({
        totals: {
          expected_cents: 100000,
          gross_paid_cents: 100000,
          adjustment_cents: 0,
          chargeback_cents: 0,
          recovery_cents: 0,
          net_actual_cents: 100000,
          remaining_expected_cents: 0,
          variance_cents: 0,
        },
        eventCount: 1,
      }).primary,
    ).toBe('paid')
    expect(commissionExceptionFlags(reconciled, true).needsAttention).toBe(false)
  })

  it('derives overpaid from positive variance without blocking or auto-adjusting', () => {
    const overpaid = item({
      id: 'ov',
      applicationId: 'app-1',
      outstandingCents: 0,
      remainingExpectedCents: -25000,
      paidCents: 125000,
      netPaidCents: 125000,
      eventCount: 1,
      derivedStatus: { primary: 'overpaid', chargedBack: false, needsReview: false },
    })
    expect(varianceCentsForWorkItem(overpaid)).toBe(25000)
    expect(commissionExceptionFlags(overpaid, true).overpaid).toBe(true)
    expect(commissionExceptionFlags(overpaid, true).needsAttention).toBe(true)
    expect(commissionExceptionNotes(overpaid, true).some((note) => note.bucket === 'overpaid')).toBe(
      true,
    )
  })

  it('keeps actual-with-no-expected visible and does not manufacture Expected $0', () => {
    const unavailable = item({
      id: 'unavail',
      applicationId: 'app-1',
      expectedCents: null,
      outstandingCents: 0,
      remainingExpectedCents: null,
      paidCents: 40000,
      netPaidCents: 40000,
      eventCount: 1,
      derivedStatus: { primary: 'expected_unavailable', chargedBack: false, needsReview: true },
    })
    expect(unavailable.expectedCents).toBeNull()
    expect(varianceCentsForWorkItem(unavailable)).toBeNull()
    expect(commissionExceptionFlags(unavailable, true).expectedUnavailable).toBe(true)
    expect(commissionExceptionFlags(unavailable, true).reconciled).toBe(false)
    const notes = commissionExceptionNotes(unavailable, true)
    expect(notes.some((note) => note.title === 'Expected unavailable')).toBe(true)
    expect(notes.join(' ')).not.toMatch(/Expected \$0|Expected \$0\.00/)
    expect(notes[0]?.detail).toMatch(/Reconciliation cannot be calculated/)
  })

  it('shows chargeback activity without treating a remaining-0 row as unresolved', () => {
    const chargedAndReconciled = item({
      id: 'cb-ok',
      applicationId: 'app-1',
      outstandingCents: 0,
      remainingExpectedCents: 0,
      paidCents: 120000,
      chargebackCents: -20000,
      netPaidCents: 100000,
      eventCount: 2,
      derivedStatus: { primary: 'paid', chargedBack: true, needsReview: false },
    })
    const flags = commissionExceptionFlags(chargedAndReconciled, true)
    expect(flags.chargebackActivity).toBe(true)
    expect(flags.reconciled).toBe(true)
    expect(flags.needsAttention).toBe(false)
    expect(
      commissionExceptionNotes(chargedAndReconciled, true).some((note) =>
        note.detail.includes('reconciles mathematically'),
      ),
    ).toBe(true)
  })

  it('derives Pending without actual from accepted Pending and no Paid activity', () => {
    const pendingOnly = item({
      id: 'pend',
      applicationId: 'app-1',
      pendingCents: 80000,
      pendingSource: pendingSource(),
    })
    const partialPaid = item({
      id: 'pend-paid',
      applicationId: 'app-1',
      outstandingCents: 50000,
      remainingExpectedCents: 50000,
      pendingCents: 80000,
      pendingSource: pendingSource(),
      paidCents: 50000,
      netPaidCents: 50000,
      eventCount: 1,
      derivedStatus: { primary: 'partially_paid', chargedBack: false, needsReview: false },
    })
    expect(commissionExceptionFlags(pendingOnly, true).pendingWithoutActual).toBe(true)
    expect(commissionExceptionFlags(pendingOnly, false).pendingWithoutActual).toBe(false)
    expect(
      commissionExceptionNotes(pendingOnly, true).some((note) => note.title === PENDING_WITHOUT_ACTUAL_COPY),
    ).toBe(true)
    expect(commissionExceptionFlags(partialPaid, true).pendingWithoutActual).toBe(false)
    expect(commissionExceptionNotes(partialPaid, true).join(' ')).not.toMatch(/payment not recorded/)
  })

  it('keeps attribution review and pending-without-actual owner-only', () => {
    const unattributed = item({
      id: 'unattr',
      applicationId: 'app-1',
      kind: 'unattributed',
      advisorId: null,
      advisorName: 'Unattributed',
      expectedCents: null,
      outstandingCents: 0,
      remainingExpectedCents: null,
      paidCents: 25000,
      netPaidCents: 25000,
      eventCount: 1,
      derivedStatus: { primary: 'expected_unavailable', chargedBack: false, needsReview: true },
    })
    expect(commissionExceptionFlags(unattributed, true).attributionReview).toBe(true)
    expect(commissionExceptionFlags(unattributed, false).attributionReview).toBe(false)
    expect(workItemMatchesExceptionBucket(unattributed, 'attribution_review', false)).toBe(false)
    expect(visibleExceptionBuckets(false)).not.toContain('attribution_review')
    expect(visibleExceptionBuckets(false)).not.toContain('pending_without_actual')
    expect(visibleExceptionBuckets(true)).toContain('attribution_review')
  })

  it('filters exception buckets in memory without a DB status', () => {
    const outstanding = item({ id: 'out', applicationId: 'app-out' })
    const reconciled = item({
      id: 'rec',
      applicationId: 'app-rec',
      outstandingCents: 0,
      remainingExpectedCents: 0,
      paidCents: 100000,
      netPaidCents: 100000,
      eventCount: 1,
      derivedStatus: { primary: 'paid', chargedBack: false, needsReview: false },
    })
    const filtered = filterCommissionWorkItems(
      [outstanding, reconciled],
      { ...defaultCommissionQueueFilters(), exceptionBucket: 'reconciled' },
      'lifetime',
      TODAY,
      { isOwner: true },
    )
    expect(filtered.map((row) => row.id)).toEqual(['rec'])
  })
})
