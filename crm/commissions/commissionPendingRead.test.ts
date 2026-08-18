import { describe, expect, it } from 'vitest'
import { buildAdvisorCompensationDashboard } from '../production/advisorCompensationView'
import type { PaidCommissionListEvent } from '../production/dashboardView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
} from '../production/types'
import {
  applyCommissionPendingToWorkItems,
  currentPendingFactsForPeriod,
  formatPendingNeedsReviewCopy,
  isCountableAcceptedPendingFact,
  overlayPendingOnAdvisorBreakdown,
  sumCurrentPendingCents,
  type AcceptedPendingSourceFact,
} from './commissionPendingRead'
import { filterCommissionWorkItems, defaultCommissionQueueFilters } from './commissionFilters'
import { buildCommissionWorkItems, isPendingOnlyCommissionStub } from './commissionWorkView'
import { validateRecordCommissionDraft } from './commissionRecordDraft'
import {
  canAttributeCommissionEvent,
  canRecordAttributedActual,
  canReverseCommissionEvent,
  defaultRecordCommissionDraft,
  writingAttributionTargets,
} from './commissionWriteView'

function expectedRow(
  partial: Partial<LiveExpectedCompensationRow> &
    Pick<LiveExpectedCompensationRow, 'id' | 'advisor_id' | 'application_id'>,
): LiveExpectedCompensationRow {
  return {
    allocation_id: `alloc-${partial.id}`,
    advisor_display_name: 'Alex Advisor',
    writing_contract_level: 'FA',
    writing_rate: '0.01',
    compensation_base_cents: 100000,
    commission_bps: 10000,
    expected_compensation_cents: 100000,
    calculation_status: 'resolved',
    review_reason: null,
    calculated_at: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function app(
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
    household: { id: 'hh1', display_name: 'Jacqueline Client' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    ...partial,
  }
}

function fact(
  partial: Partial<AcceptedPendingSourceFact> &
    Pick<AcceptedPendingSourceFact, 'id' | 'applicationId' | 'allocationId' | 'advisorId'>,
): AcceptedPendingSourceFact {
  return {
    batchId: `batch-${partial.id}`,
    pendingReviewStatus: 'accepted_pending',
    sourceIncomeCents: 335512,
    statementDate: '2026-08-17',
    statementIdentifier: 'experior-pending:A42353:2026-08-17',
    sourceFile: 'valtoris-experior-pending-import.csv',
    sourceCreatedAt: '2026-08-17T15:57:28Z',
    createdAt: '2026-08-17T16:00:00.000Z',
    transactionDate: '2026-08-17',
    sourceWritingAssociate: 'Jacqueline Juarez',
    sourceClient: 'Jacqueline Client',
    sourcePolicyNumber: 'ST11314961',
    sourceCompany: 'Symetra',
    sourceProduct: 'Life',
    ...partial,
  }
}

function event(
  partial: Partial<PaidCommissionListEvent> & Pick<PaidCommissionListEvent, 'id' | 'application_id'>,
): PaidCommissionListEvent {
  return {
    advisor_id: 'adv-jacqueline',
    allocation_id: 'alloc-jacqueline',
    event_type: 'paid',
    amount_cents: 50000,
    reversed_event_id: null,
    transaction_date: '2026-08-10',
    ...partial,
  }
}

const TODAY = '2026-08-17'

describe('commission Phase C current Pending derivation', () => {
  it('includes accepted_pending Source Income and excludes review, ignored, duplicate, Override, and additional', () => {
    const rows = [
      fact({
        id: 'accepted',
        applicationId: 'app-1',
        allocationId: 'alloc-j',
        advisorId: 'adv-j',
        sourceIncomeCents: 335512,
      }),
      fact({
        id: 'review',
        applicationId: 'app-1',
        allocationId: 'alloc-j',
        advisorId: 'adv-j',
        pendingReviewStatus: 'review_policy_match',
        sourceIncomeCents: 999999,
      }),
      fact({
        id: 'ignored-override',
        applicationId: 'app-1',
        allocationId: 'alloc-yadira-1046',
        advisorId: 'adv-yadira',
        pendingReviewStatus: 'ignored_nonwriting',
        sourceIncomeCents: 1046,
      }),
      fact({
        id: 'ignored-override-2',
        applicationId: 'app-1',
        allocationId: 'alloc-yadira-3952',
        advisorId: 'adv-yadira',
        pendingReviewStatus: 'ignored_nonwriting',
        sourceIncomeCents: 3952,
      }),
      fact({
        id: 'additional',
        applicationId: 'app-1',
        allocationId: 'alloc-add',
        advisorId: 'adv-j',
        pendingReviewStatus: 'ignored_nonpolicy',
        sourceIncomeCents: 8800,
      }),
      fact({
        id: 'duplicate',
        applicationId: 'app-1',
        allocationId: 'alloc-j',
        advisorId: 'adv-j',
        pendingReviewStatus: 'duplicate',
        sourceIncomeCents: 335512,
      }),
    ]
    expect(rows.filter(isCountableAcceptedPendingFact).map((row) => row.id)).toEqual(['accepted'])
    const current = currentPendingFactsForPeriod(rows, 'lifetime', TODAY)
    expect(sumCurrentPendingCents(current)).toBe(335512)
  })

  it('uses the Jacqueline writing total only and does not include escrow or statement amount', () => {
    const current = currentPendingFactsForPeriod(
      [
        fact({
          id: 'jacqueline',
          applicationId: 'app-jac',
          allocationId: 'alloc-jac',
          advisorId: 'adv-jac',
          sourceIncomeCents: 335512,
        }),
      ],
      'lifetime',
      TODAY,
    )
    expect(sumCurrentPendingCents(current)).toBe(335512)
    expect(sumCurrentPendingCents(current)).not.toBe(337105)
    expect(sumCurrentPendingCents(current)).not.toBe(335512 + 3405)
  })

  it('lets the latest accepted fact per allocation win and does not sum history', () => {
    const current = currentPendingFactsForPeriod(
      [
        fact({
          id: 'older',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
          statementDate: '2026-07-01',
          createdAt: '2026-07-02T00:00:00.000Z',
        }),
        fact({
          id: 'newer',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 150000,
          statementDate: '2026-08-17',
          createdAt: '2026-08-17T00:00:00.000Z',
        }),
      ],
      'lifetime',
      TODAY,
    )
    expect(current).toHaveLength(1)
    expect(current[0]?.sourceIncomeCents).toBe(150000)
    expect(sumCurrentPendingCents(current)).toBe(150000)
  })

  it('does not double Pending on same-batch retry facts with a later created_at', () => {
    const current = currentPendingFactsForPeriod(
      [
        fact({
          id: 'first',
          batchId: 'batch-same',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
          statementDate: '2026-08-17',
          createdAt: '2026-08-17T16:00:00.000Z',
        }),
        fact({
          id: 'retry',
          batchId: 'batch-same',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
          statementDate: '2026-08-17',
          createdAt: '2026-08-17T16:05:00.000Z',
        }),
      ],
      'lifetime',
      TODAY,
    )
    expect(current).toHaveLength(1)
    expect(current[0]?.id).toBe('retry')
    expect(sumCurrentPendingCents(current)).toBe(335512)
  })

  it('uses statement date for This Month / YTD / Lifetime and returns 0 when none are accepted', () => {
    const rows = [
      fact({
        id: 'july',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        sourceIncomeCents: 335512,
        statementDate: '2026-07-15',
      }),
      fact({
        id: 'august',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        sourceIncomeCents: 150000,
        statementDate: '2026-08-17',
      }),
    ]
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod(rows, 'this_month', TODAY))).toBe(
      150000,
    )
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod(rows, 'ytd', TODAY))).toBe(150000)
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod(rows, 'lifetime', TODAY))).toBe(
      150000,
    )
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod(rows, 'this_month', '2026-07-31'))).toBe(
      335512,
    )
    expect(
      sumCurrentPendingCents(
        currentPendingFactsForPeriod(
          [
            fact({
              id: 'july-only',
              applicationId: 'app-1',
              allocationId: 'alloc-a',
              advisorId: 'adv-a',
              sourceIncomeCents: 335512,
              statementDate: '2026-07-15',
            }),
          ],
          'this_month',
          TODAY,
        ),
      ),
    ).toBe(0)
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod([], 'lifetime', TODAY))).toBe(0)
  })

  it('keeps split-writer Pending on the attributed allocation without multiplying by 75%', () => {
    const application = app({
      id: 'app-split',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-split',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
          commission_bps: 7500,
          expected_compensation_cents: 75000,
        }),
        expectedRow({
          id: 'e-b',
          application_id: 'app-split',
          advisor_id: 'adv-b',
          allocation_id: 'alloc-b',
          advisor_display_name: 'Writer B',
          commission_bps: 2500,
          expected_compensation_cents: 25000,
        }),
      ],
    })
    const workItems = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: currentPendingFactsForPeriod(
        [
          fact({
            id: 'a-pending',
            applicationId: 'app-split',
            allocationId: 'alloc-a',
            advisorId: 'adv-a',
            sourceIncomeCents: 335512,
          }),
        ],
        'lifetime',
        TODAY,
      ),
    })
    const writerA = workItems.find((row) => row.allocationId === 'alloc-a')
    const writerB = workItems.find((row) => row.allocationId === 'alloc-b')
    expect(writerA?.id).toBe('app-split:alloc-a')
    expect(writerA?.pendingCents).toBe(335512)
    expect(writerB?.pendingCents).toBe(0)
    expect(writerA?.pendingCents).not.toBe(251634)
    const overlaid = overlayPendingOnAdvisorBreakdown(
      [
        {
          advisorId: 'adv-a',
          advisorName: 'Writer A',
          expectedCents: 75000,
          outstandingCents: 75000,
          paidCents: 0,
          chargebackCents: 0,
          netPaidCents: 0,
          reviewCount: 0,
        },
        {
          advisorId: 'adv-b',
          advisorName: 'Writer B',
          expectedCents: 25000,
          outstandingCents: 25000,
          paidCents: 0,
          chargebackCents: 0,
          netPaidCents: 0,
          reviewCount: 0,
        },
      ],
      currentPendingFactsForPeriod(
        [
          fact({
            id: 'a-pending',
            applicationId: 'app-split',
            allocationId: 'alloc-a',
            advisorId: 'adv-a',
            sourceIncomeCents: 335512,
          }),
        ],
        'lifetime',
        TODAY,
      ),
      [application],
    )
    expect(overlaid.find((row) => row.advisorId === 'adv-a')?.pendingCents).toBe(335512)
    expect(overlaid.find((row) => row.advisorId === 'adv-b')?.pendingCents).toBe(0)
  })

  it('keys queue Pending by allocation_id and includes statement-date period membership', () => {
    const application = app({
      id: 'app-old',
      production_stage: 'issued',
      submission_date: '2025-12-01',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-old',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
        }),
      ],
    })
    const workItems = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: currentPendingFactsForPeriod(
        [
          fact({
            id: 'aug',
            applicationId: 'app-old',
            allocationId: 'alloc-a',
            advisorId: 'adv-a',
            sourceIncomeCents: 335512,
            statementDate: '2026-08-17',
          }),
        ],
        'this_month',
        TODAY,
      ),
    })
    expect(workItems[0]?.id).toBe('app-old:alloc-a')
    expect(workItems[0]?.pendingCents).toBe(335512)
    expect(
      filterCommissionWorkItems(
        workItems,
        defaultCommissionQueueFilters(),
        'this_month',
        TODAY,
      ),
    ).toHaveLength(1)
  })

  it('does not change Outstanding, Paid, Chargebacks, or Net Paid when Pending is attached', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'in_force',
      expected_compensations: [
        expectedRow({
          id: 'e1',
          application_id: 'app-1',
          advisor_id: 'adv-jacqueline',
          allocation_id: 'alloc-jacqueline',
          advisor_display_name: 'Jacqueline Juarez',
          expected_compensation_cents: 400000,
        }),
      ],
    })
    const events = [
      event({
        id: 'paid-1',
        application_id: 'app-1',
        amount_cents: 50000,
      }),
      event({
        id: 'cb-1',
        application_id: 'app-1',
        event_type: 'chargeback',
        amount_cents: -10000,
      }),
    ]
    const before = buildCommissionWorkItems({ items: [application], events })
    const after = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: before,
      currentFacts: [
        fact({
          id: 'p1',
          applicationId: 'app-1',
          allocationId: 'alloc-jacqueline',
          advisorId: 'adv-jacqueline',
        }),
      ],
    })
    expect(after[0]?.pendingCents).toBe(335512)
    expect(after[0]?.outstandingCents).toBe(before[0]?.outstandingCents)
    expect(after[0]?.paidCents).toBe(before[0]?.paidCents)
    expect(after[0]?.chargebackCents).toBe(before[0]?.chargebackCents)
    expect(after[0]?.netPaidCents).toBe(before[0]?.netPaidCents)
    expect(after[0]?.outstandingCents).toBe(360000)

    const dashboard = buildAdvisorCompensationDashboard({
      items: [application],
      events,
      period: 'lifetime',
      today: TODAY,
    })
    const pendingFacts = [
      fact({
        id: 'p1',
        applicationId: 'app-1',
        allocationId: 'alloc-jacqueline',
        advisorId: 'adv-jacqueline',
      }),
    ]
    const overlaid = overlayPendingOnAdvisorBreakdown(
      dashboard.rows,
      pendingFacts,
      [application],
    )
    expect(overlaid[0]?.pendingCents).toBe(335512)
    expect(overlaid[0]?.outstandingCents).toBe(dashboard.rows[0]?.outstandingCents)
    expect(overlaid[0]?.paidCents).toBe(dashboard.rows[0]?.paidCents)
    expect(overlaid[0]?.chargebackCents).toBe(dashboard.rows[0]?.chargebackCents)
    expect(overlaid[0]?.netPaidCents).toBe(dashboard.rows[0]?.netPaidCents)
    expect(dashboard.totals.outstandingCents).toBe(360000)
  })

  it('treats empty RLS-visible facts as $0.00 Pending and formats review copy without mixing dollars', () => {
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod([], 'lifetime', TODAY))).toBe(0)
    expect(formatPendingNeedsReviewCopy(0)).toBeNull()
    expect(formatPendingNeedsReviewCopy(1)).toBe('1 pending-import row needs review')
    expect(formatPendingNeedsReviewCopy(3)).toBe('3 pending-import rows need review')
  })

  it('counts two legitimate distinct accepted Pending facts exactly once each', () => {
    const current = currentPendingFactsForPeriod(
      [
        fact({
          id: 'a',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
        }),
        fact({
          id: 'b',
          applicationId: 'app-1',
          allocationId: 'alloc-b',
          advisorId: 'adv-b',
          sourceIncomeCents: 88000,
        }),
      ],
      'lifetime',
      TODAY,
    )
    expect(current).toHaveLength(2)
    expect(sumCurrentPendingCents(current)).toBe(335512 + 88000)
  })

  it('fails closed when application, allocation, or advisor references are absent', () => {
    const rows = [
      fact({
        id: 'no-app',
        applicationId: '',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
      }),
      fact({
        id: 'no-alloc',
        applicationId: 'app-1',
        allocationId: '',
        advisorId: 'adv-a',
      }),
      fact({
        id: 'no-adv',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: '',
      }),
      fact({
        id: 'rejected',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        pendingReviewStatus: 'invalid_amount',
        sourceIncomeCents: 999,
      }),
      fact({
        id: 'ok',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        sourceIncomeCents: 335512,
      }),
    ]
    expect(rows.filter(isCountableAcceptedPendingFact).map((row) => row.id)).toEqual(['ok'])
    expect(sumCurrentPendingCents(currentPendingFactsForPeriod(rows, 'lifetime', TODAY))).toBe(
      335512,
    )
  })

  it('creates a UI-only stub only when the resolved allocation is missing from the queue', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
          expected_compensation_cents: 75000,
        }),
      ],
    })
    const facts = [
      fact({
        id: 'b-pending',
        applicationId: 'app-1',
        allocationId: 'alloc-b',
        advisorId: 'adv-b',
        sourceIncomeCents: 88000,
        sourceWritingAssociate: 'Writer B',
      }),
    ]
    const before = buildCommissionWorkItems({ items: [application], events: [] })
    const after = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: before,
      currentFacts: facts,
    })
    const stub = after.find((row) => row.allocationId === 'alloc-b')
    const writerA = after.find((row) => row.allocationId === 'alloc-a')
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(2)
    expect(writerA?.pendingCents).toBe(0)
    expect(stub?.id).toBe('app-1:alloc-b')
    expect(stub?.kind).toBe('writing_advisor')
    expect(stub?.pendingCents).toBe(88000)
    expect(stub?.expectedCents).toBeNull()
    expect(stub?.outstandingCents).toBe(0)
    expect(stub?.paidCents).toBe(0)
    expect(stub?.chargebackCents).toBe(0)
    expect(stub?.netPaidCents).toBe(0)
    expect(stub?.expectedRow).toBeNull()
    expect(stub?.pendingOnlyStub).toBe(true)
    expect(isPendingOnlyCommissionStub(stub!)).toBe(true)
    expect(writerA?.pendingOnlyStub).toBe(false)
    expect(stub?.pendingSource?.rowId).toBe('b-pending')
    expect(after.filter((row) => row.applicationId === 'app-1' && row.allocationId === 'alloc-b')).toHaveLength(
      1,
    )
  })

  it('does not stub or duplicate when the allocation already has a work item', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
        }),
      ],
    })
    const duplicateFacts = [
      fact({
        id: 'first',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        sourceIncomeCents: 335512,
      }),
      fact({
        id: 'second',
        applicationId: 'app-1',
        allocationId: 'alloc-a',
        advisorId: 'adv-a',
        sourceIncomeCents: 335512,
        createdAt: '2026-08-17T16:05:00.000Z',
      }),
    ]
    const after = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: duplicateFacts,
    })
    expect(after).toHaveLength(1)
    expect(after[0]?.id).toBe('app-1:alloc-a')
    expect(after[0]?.pendingCents).toBe(335512)
    expect(after.filter((row) => row.allocationId === 'alloc-a')).toHaveLength(1)
  })

  it('does not create two stubs for duplicate uncovered facts and does not inflate KPI or advisor totals', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'submitted',
    })
    const duplicateFacts = [
      fact({
        id: 'first',
        applicationId: 'app-1',
        allocationId: 'alloc-orphan',
        advisorId: 'adv-orphan',
        sourceIncomeCents: 88000,
      }),
      fact({
        id: 'second',
        applicationId: 'app-1',
        allocationId: 'alloc-orphan',
        advisorId: 'adv-orphan',
        sourceIncomeCents: 88000,
        createdAt: '2026-08-17T16:05:00.000Z',
      }),
    ]
    const current = currentPendingFactsForPeriod(duplicateFacts, 'lifetime', TODAY)
    const after = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: duplicateFacts,
    })
    const overlaid = overlayPendingOnAdvisorBreakdown([], current, [application])
    expect(after.filter((row) => row.allocationId === 'alloc-orphan')).toHaveLength(1)
    expect(sumCurrentPendingCents(current)).toBe(88000)
    expect(overlaid.reduce((sum, row) => sum + row.pendingCents, 0)).toBe(88000)
    expect(overlaid.find((row) => row.advisorId === 'adv-orphan')?.expectedCents).toBe(0)
    expect(overlaid.find((row) => row.advisorId === 'adv-orphan')?.paidCents).toBe(0)
  })

  it('reconciles global Pending to advisor Pending exactly once and ignores queue filters', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
          expected_compensation_cents: 75000,
        }),
        expectedRow({
          id: 'e-b',
          application_id: 'app-1',
          advisor_id: 'adv-b',
          allocation_id: 'alloc-b',
          advisor_display_name: 'Writer B',
          expected_compensation_cents: 25000,
        }),
      ],
    })
    const facts = currentPendingFactsForPeriod(
      [
        fact({
          id: 'a',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
        }),
        fact({
          id: 'b',
          applicationId: 'app-1',
          allocationId: 'alloc-b',
          advisorId: 'adv-b',
          sourceIncomeCents: 88000,
        }),
      ],
      'lifetime',
      TODAY,
    )
    const dashboard = buildAdvisorCompensationDashboard({
      items: [application],
      events: [],
      period: 'lifetime',
      today: TODAY,
    })
    const overlaid = overlayPendingOnAdvisorBreakdown(dashboard.rows, facts, [application])
    const workItems = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: facts,
    })
    const globalPending = sumCurrentPendingCents(facts)
    const advisorPending = overlaid.reduce((sum, row) => sum + row.pendingCents, 0)
    const queuePending = workItems.reduce((sum, row) => sum + row.pendingCents, 0)
    const filtered = filterCommissionWorkItems(
      workItems,
      { ...defaultCommissionQueueFilters(), advisorId: 'adv-a' },
      'lifetime',
      TODAY,
    )
    expect(globalPending).toBe(335512 + 88000)
    expect(advisorPending).toBe(globalPending)
    expect(queuePending).toBe(globalPending)
    expect(filtered.reduce((sum, row) => sum + row.pendingCents, 0)).toBe(335512)
    expect(dashboard.totals.expectedCents).toBe(100000)
    expect(dashboard.totals.outstandingCents).toBe(100000)
    expect(dashboard.totals.paidCents).toBe(0)
    expect(dashboard.totals.chargebackCents).toBe(0)
    expect(dashboard.totals.netPaidCents).toBe(0)
    expect(overlaid.find((row) => row.advisorId === 'adv-a')?.expectedCents).toBe(
      dashboard.rows.find((row) => row.advisorId === 'adv-a')?.expectedCents,
    )
  })

  it('keeps Pending-only stubs visible and blocks every 035 mutation helper', () => {
    const application = app({
      id: 'app-1',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Writer A',
          expected_compensation_cents: 75000,
        }),
      ],
    })
    const workItems = applyCommissionPendingToWorkItems({
      items: [application],
      workItems: buildCommissionWorkItems({ items: [application], events: [] }),
      currentFacts: [
        fact({
          id: 'a-pending',
          applicationId: 'app-1',
          allocationId: 'alloc-a',
          advisorId: 'adv-a',
          sourceIncomeCents: 335512,
        }),
        fact({
          id: 'b-pending',
          applicationId: 'app-1',
          allocationId: 'alloc-b',
          advisorId: 'adv-b',
          sourceIncomeCents: 88000,
          sourceWritingAssociate: 'Writer B',
        }),
      ],
    })
    const real = workItems.find((row) => row.allocationId === 'alloc-a')
    const stub = workItems.find((row) => row.allocationId === 'alloc-b')
    const queued = filterCommissionWorkItems(
      workItems,
      defaultCommissionQueueFilters(),
      'lifetime',
      TODAY,
    )
    const paidEvent = {
      id: 'paid-1',
      event_type: 'paid' as const,
      amount_cents: 100,
      transaction_date: '2026-08-17',
      statement_identifier: null,
      policy_reference: null,
      source_file: null,
      source_row: null,
      reversed_event_id: null,
      import_batch_identifier: null,
      reason: 'statement',
      created_at: '2026-08-17T00:00:00.000Z',
      idempotency_key: 'manual035:stub',
    }

    expect(real?.pendingOnlyStub).toBe(false)
    expect(real?.pendingCents).toBe(335512)
    expect(canRecordAttributedActual(true, real!)).toBe(true)
    expect(
      validateRecordCommissionDraft({
        item: real!,
        draft: {
          ...defaultRecordCommissionDraft(TODAY),
          amountInput: '10.00',
          reason: 'carrier paid',
        },
        idempotencyKey: 'manual035:real',
        preIssue: false,
        includeCarrierId: true,
      }).ok,
    ).toBe(true)

    expect(stub?.pendingOnlyStub).toBe(true)
    expect(stub?.pendingCents).toBe(88000)
    expect(queued.map((row) => row.id).sort()).toEqual(['app-1:alloc-a', 'app-1:alloc-b'])
    expect(canRecordAttributedActual(true, stub!)).toBe(false)
    expect(
      canReverseCommissionEvent({
        isOwner: true,
        event: paidEvent,
        allEvents: [paidEvent],
        pendingOnlyStub: stub?.pendingOnlyStub,
      }),
    ).toBe(false)
    expect(
      canAttributeCommissionEvent({
        isOwner: true,
        unattributed: true,
        event: paidEvent,
        allEvents: [paidEvent],
        pendingOnlyStub: stub?.pendingOnlyStub,
      }),
    ).toBe(false)
    const blockedDraft = validateRecordCommissionDraft({
      item: stub!,
      draft: {
        ...defaultRecordCommissionDraft(TODAY),
        amountInput: '10.00',
        reason: 'should not post',
      },
      idempotencyKey: 'manual035:stub',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(blockedDraft.ok).toBe(false)
    expect(writingAttributionTargets(workItems, 'app-1').map((row) => row.allocationId)).toEqual([
      'alloc-a',
    ])
    expect(writingAttributionTargets(workItems, 'app-1').map((row) => row.allocationId)).not.toContain(
      'alloc-b',
    )
  })
})
