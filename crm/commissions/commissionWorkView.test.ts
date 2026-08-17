import { describe, expect, it } from 'vitest'
import { buildAdvisorCompensationDashboard } from '../production/advisorCompensationView'
import type { PaidCommissionListEvent } from '../production/dashboardView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
} from '../production/types'
import { filterCommissionWorkItems, defaultCommissionQueueFilters } from './commissionFilters'
import {
  buildCommissionWorkItems,
  deriveCommissionWorkStatus,
  formatCommissionWorkStatusLabel,
  summarizeUnattributedCommission,
} from './commissionWorkView'
import { snapshotForCommissionWorkItem } from './commissionSnapshotView'
import type { WritingCommissionSnapshotView } from '../production/compensationApi'
import { EMPTY_COMMISSION_TOTALS } from '../production/compensationApi'

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

function item(
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
    ...partial,
  }
}

function event(
  partial: Partial<PaidCommissionListEvent> & Pick<PaidCommissionListEvent, 'id' | 'application_id'>,
): PaidCommissionListEvent {
  return {
    advisor_id: 'adv-a',
    allocation_id: null,
    event_type: 'paid',
    amount_cents: 50000,
    reversed_event_id: null,
    transaction_date: '2026-08-10',
    ...partial,
  }
}

const TODAY = '2026-08-16'

function work(
  items: ProductionApplicationListItem[],
  events: PaidCommissionListEvent[] = [],
) {
  return buildCommissionWorkItems({ items, events })
}

describe('commission work items grain and presentation', () => {
  it('creates two work items for split writing advisors on one application', () => {
    const app = item({
      id: 'app-split',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'e-jared',
          application_id: 'app-split',
          advisor_id: 'adv-jared',
          allocation_id: 'alloc-jared',
          advisor_display_name: 'Jared',
          commission_bps: 7500,
          expected_compensation_cents: 75000,
        }),
        expectedRow({
          id: 'e-jazmin',
          application_id: 'app-split',
          advisor_id: 'adv-jazmin',
          allocation_id: 'alloc-jazmin',
          advisor_display_name: 'Jazmin',
          commission_bps: 2500,
          expected_compensation_cents: 25000,
        }),
      ],
    })
    const rows = work([app], [
      event({
        id: 'p-jared',
        application_id: 'app-split',
        advisor_id: 'adv-jared',
        allocation_id: 'alloc-jared',
        amount_cents: 75000,
      }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.id).sort()).toEqual([
      'app-split:alloc-jared',
      'app-split:alloc-jazmin',
    ])
    const jared = rows.find((row) => row.advisorId === 'adv-jared')
    const jazmin = rows.find((row) => row.advisorId === 'adv-jazmin')
    expect(jared?.expectedCents).toBe(75000)
    expect(jared?.paidCents).toBe(75000)
    expect(jared?.outstandingCents).toBe(0)
    expect(jared?.derivedStatus.primary).toBe('paid')
    expect(jazmin?.expectedCents).toBe(25000)
    expect(jazmin?.paidCents).toBe(0)
    expect(jazmin?.outstandingCents).toBe(25000)
    expect(jazmin?.derivedStatus.primary).toBe('outstanding')
  })

  it('uses generic client / reference / provider / product-service labels for insurance data', () => {
    const rows = work([
      item({
        id: 'app-1',
        production_stage: 'issued',
        expected_compensations: [
          expectedRow({ id: 'e1', application_id: 'app-1', advisor_id: 'adv-a' }),
        ],
      }),
    ])
    expect(rows[0]?.clientLabel).toBe('Rivera Household')
    expect(rows[0]?.referenceLabel).toBe('POL-1')
    expect(rows[0]?.providerLabel).toBe('Acme Life')
    expect(rows[0]?.productServiceLabel).toBe('Term 20')
  })

  it('does not collapse split writers into a case total row', () => {
    const rows = work([
      item({
        id: 'app-split',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({
            id: 'a',
            application_id: 'app-split',
            advisor_id: 'adv-a',
            expected_compensation_cents: 75000,
          }),
          expectedRow({
            id: 'b',
            application_id: 'app-split',
            advisor_id: 'adv-b',
            advisor_display_name: 'Jazmin',
            expected_compensation_cents: 25000,
          }),
        ],
      }),
    ])
    expect(rows.some((row) => row.expectedCents === 100000)).toBe(false)
    expect(rows.map((row) => row.expectedCents).sort()).toEqual([25000, 75000])
  })
})

describe('commission metrics', () => {
  it('omits unresolved expected dollars and flags review', () => {
    const rows = work([
      item({
        id: 'app-1',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({
            id: 'rev',
            application_id: 'app-1',
            advisor_id: 'adv-a',
            calculation_status: 'review_required',
            review_reason: 'missing_compensation_base',
            expected_compensation_cents: null,
          }),
        ],
      }),
    ])
    expect(rows[0]?.expectedCents).toBeNull()
    expect(rows[0]?.outstandingCents).toBe(0)
    expect(rows[0]?.derivedStatus.primary).toBe('needs_review')
    expect(rows[0]?.derivedStatus.needsReview).toBe(true)
    expect(rows[0]?.reviewReason).toMatch(/premium or annuity deposit/i)
  })

  it('marks unavailable expected without inventing $0 as paid', () => {
    const rows = work([
      item({
        id: 'app-1',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({
            id: 'na',
            application_id: 'app-1',
            advisor_id: 'adv-a',
            calculation_status: 'unavailable',
            review_reason: 'no_rate_card',
            expected_compensation_cents: null,
          }),
        ],
      }),
    ])
    expect(rows[0]?.expectedCents).toBeNull()
    expect(rows[0]?.derivedStatus.primary).toBe('expected_unavailable')
  })

  it('computes outstanding only for alive stages and floors at zero', () => {
    const expected = expectedRow({
      id: 'e1',
      application_id: 'app-1',
      advisor_id: 'adv-a',
      expected_compensation_cents: 100000,
    })
    const paid = event({
      id: 'p1',
      application_id: 'app-1',
      amount_cents: 40000,
    })
    const submitted = work(
      [item({ id: 'app-1', production_stage: 'submitted', expected_compensations: [expected] })],
      [paid],
    )
    expect(submitted[0]?.outstandingCents).toBe(60000)
    expect(submitted[0]?.derivedStatus.primary).toBe('partially_paid')

    const withdrawn = work(
      [
        item({
          id: 'app-1',
          production_stage: 'withdrawn',
          expected_compensations: [expected],
        }),
      ],
      [paid],
    )
    expect(withdrawn[0]?.expectedCents).toBe(100000)
    expect(withdrawn[0]?.outstandingCents).toBe(0)

    const overpaid = work(
      [item({ id: 'app-1', production_stage: 'issued', expected_compensations: [expected] })],
      [event({ id: 'p2', application_id: 'app-1', amount_cents: 120000 })],
    )
    expect(overpaid[0]?.outstandingCents).toBe(0)
    expect(overpaid[0]?.derivedStatus.primary).toBe('overpaid')
  })

  it('treats draft and pre_submitted as zero outstanding', () => {
    for (const stage of ['draft', 'pre_submitted'] as const) {
      const rows = work([
        item({
          id: 'app-1',
          production_stage: stage,
          expected_compensations: [
            expectedRow({
              id: 'e1',
              application_id: 'app-1',
              advisor_id: 'adv-a',
              expected_compensation_cents: 100000,
            }),
          ],
        }),
      ])
      expect(rows[0]?.outstandingCents).toBe(0)
    }
  })

  it('keeps paid history after chargeback and shows net zero', () => {
    const expected = expectedRow({
      id: 'e1',
      application_id: 'app-1',
      advisor_id: 'adv-a',
      expected_compensation_cents: 100000,
    })
    const rows = work(
      [item({ id: 'app-1', production_stage: 'in_force', expected_compensations: [expected] })],
      [
        event({ id: 'p1', application_id: 'app-1', amount_cents: 100000 }),
        event({
          id: 'c1',
          application_id: 'app-1',
          event_type: 'chargeback',
          amount_cents: -100000,
        }),
      ],
    )
    expect(rows[0]?.paidCents).toBe(100000)
    expect(rows[0]?.chargebackCents).toBe(-100000)
    expect(rows[0]?.netPaidCents).toBe(0)
    expect(rows[0]?.outstandingCents).toBe(100000)
    expect(rows[0]?.derivedStatus.primary).toBe('net_zero')
    expect(rows[0]?.derivedStatus.chargedBack).toBe(true)
  })

  it('includes recovery and adjustment in net paid', () => {
    const expected = expectedRow({
      id: 'e1',
      application_id: 'app-1',
      advisor_id: 'adv-a',
      expected_compensation_cents: 100000,
    })
    const rows = work(
      [item({ id: 'app-1', production_stage: 'issued', expected_compensations: [expected] })],
      [
        event({ id: 'p1', application_id: 'app-1', amount_cents: 80000 }),
        event({
          id: 'a1',
          application_id: 'app-1',
          event_type: 'adjustment',
          amount_cents: -5000,
        }),
        event({
          id: 'r1',
          application_id: 'app-1',
          event_type: 'recovery',
          amount_cents: 5000,
        }),
      ],
    )
    expect(rows[0]?.netPaidCents).toBe(80000)
    expect(rows[0]?.derivedStatus.primary).toBe('partially_paid')
  })

  it('excludes reversals and reversed facts from paid and net', () => {
    const expected = expectedRow({
      id: 'e1',
      application_id: 'app-1',
      advisor_id: 'adv-a',
      expected_compensation_cents: 100000,
    })
    const rows = work(
      [item({ id: 'app-1', production_stage: 'issued', expected_compensations: [expected] })],
      [
        event({ id: 'p1', application_id: 'app-1', amount_cents: 40000 }),
        event({
          id: 'rev',
          application_id: 'app-1',
          event_type: 'reversal',
          amount_cents: -40000,
          reversed_event_id: 'p1',
        }),
      ],
    )
    expect(rows[0]?.paidCents).toBe(0)
    expect(rows[0]?.netPaidCents).toBe(0)
    expect(rows[0]?.outstandingCents).toBe(100000)
    expect(rows[0]?.derivedStatus.primary).toBe('outstanding')
  })

  it('matches dashboard outstanding for the same pair', () => {
    const app = item({
      id: 'app-1',
      production_stage: 'approved',
      expected_compensations: [
        expectedRow({
          id: 'e1',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          expected_compensation_cents: 100000,
        }),
      ],
    })
    const events = [event({ id: 'p1', application_id: 'app-1', amount_cents: 25000 })]
    const rows = work([app], events)
    const dashboard = buildAdvisorCompensationDashboard({
      items: [app],
      events,
      period: 'lifetime',
      today: TODAY,
    })
    expect(rows[0]?.outstandingCents).toBe(dashboard.rows[0]?.outstandingCents)
    expect(rows[0]?.expectedCents).toBe(dashboard.rows[0]?.expectedCents)
  })
})

describe('unattributed and advisor isolation', () => {
  it('keeps unattributed cash as a separate owner work item', () => {
    const rows = work(
      [item({ id: 'app-1', production_stage: 'issued', expected_compensations: [] })],
      [
        event({
          id: 'u1',
          application_id: 'app-1',
          advisor_id: null,
          allocation_id: null,
          amount_cents: 12000,
        }),
      ],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('unattributed')
    expect(rows[0]?.advisorId).toBeNull()
    expect(rows[0]?.netPaidCents).toBe(12000)
    expect(summarizeUnattributedCommission({ items: rows, viewer: 'owner' })?.netCents).toBe(12000)
    expect(summarizeUnattributedCommission({ items: rows, viewer: 'advisor' })).toBeNull()
  })

  it('advisor-visible RLS shape cannot include another writer expected or paid', () => {
    const advisorView = item({
      id: 'app-split',
      production_stage: 'submitted',
      expected_compensations: [
        expectedRow({
          id: 'mine',
          application_id: 'app-split',
          advisor_id: 'adv-a',
          expected_compensation_cents: 75000,
        }),
      ],
    })
    const rows = work(
      [advisorView],
      [
        event({
          id: 'p-a',
          application_id: 'app-split',
          advisor_id: 'adv-a',
          amount_cents: 10000,
        }),
      ],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.advisorId).toBe('adv-a')
    expect(rows[0]?.paidCents).toBe(10000)
    expect(rows[0]?.expectedCents).toBe(75000)
    expect(rows.some((row) => row.advisorId === 'adv-b')).toBe(false)
  })
})

describe('derived status labels', () => {
  it('does not invent Pending, Eligible, or Released', () => {
    for (const status of [
      'needs_review',
      'no_payments',
      'outstanding',
      'partially_paid',
      'paid',
      'overpaid',
      'net_zero',
      'expected_unavailable',
    ] as const) {
      const label = formatCommissionWorkStatusLabel(status)
      expect(label).not.toMatch(/pending|eligible|released/i)
    }
  })

  it('uses deriveActualStatus paid/partial/overpaid/net-zero semantics', () => {
    expect(
      deriveCommissionWorkStatus({
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
      }).primary,
    ).toBe('paid')
  })
})

describe('commission queue filters', () => {
  it('filters by search, advisor, provider, and needs review', () => {
    const rows = work([
      item({
        id: 'app-1',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({
            id: 'ok',
            application_id: 'app-1',
            advisor_id: 'adv-a',
            expected_compensation_cents: 50000,
          }),
          expectedRow({
            id: 'rev',
            application_id: 'app-1',
            advisor_id: 'adv-b',
            advisor_display_name: 'Jordan',
            calculation_status: 'review_required',
            review_reason: 'missing_lookup_date',
            expected_compensation_cents: null,
          }),
        ],
      }),
    ])
    const filters = defaultCommissionQueueFilters()
    expect(
      filterCommissionWorkItems(rows, { ...filters, search: 'jordan' }, 'lifetime', TODAY),
    ).toHaveLength(1)
    expect(
      filterCommissionWorkItems(rows, { ...filters, advisorId: 'adv-a' }, 'lifetime', TODAY),
    ).toHaveLength(1)
    expect(
      filterCommissionWorkItems(rows, { ...filters, providerId: 'c1' }, 'lifetime', TODAY),
    ).toHaveLength(2)
    expect(
      filterCommissionWorkItems(rows, { ...filters, needsReviewOnly: true }, 'lifetime', TODAY),
    ).toHaveLength(1)
    expect(
      filterCommissionWorkItems(
        rows,
        { ...filters, derivedStatus: 'needs_review' },
        'lifetime',
        TODAY,
      ),
    ).toHaveLength(1)
  })

  it('uses expected/application date for this-month membership and payment date for paid activity', () => {
    const rows = work(
      [
        item({
          id: 'old',
          production_stage: 'issued',
          submission_date: '2025-12-01',
          expected_compensations: [
            expectedRow({
              id: 'old-e',
              application_id: 'old',
              advisor_id: 'adv-a',
              expected_compensation_cents: 10000,
            }),
          ],
        }),
      ],
      [
        event({
          id: 'p-old',
          application_id: 'old',
          amount_cents: 10000,
          transaction_date: '2026-08-02',
        }),
      ],
    )
    const filtered = filterCommissionWorkItems(
      rows,
      defaultCommissionQueueFilters(),
      'this_month',
      TODAY,
    )
    expect(filtered).toHaveLength(1)
    const lastYear = filterCommissionWorkItems(
      work([
        item({
          id: 'old2',
          production_stage: 'issued',
          submission_date: '2025-12-01',
          expected_compensations: [
            expectedRow({
              id: 'old2-e',
              application_id: 'old2',
              advisor_id: 'adv-a',
              expected_compensation_cents: 10000,
            }),
          ],
        }),
      ]),
      defaultCommissionQueueFilters(),
      'this_month',
      TODAY,
    )
    expect(lastYear).toHaveLength(0)
  })
})

describe('snapshot slicing', () => {
  it('drops the other writer and unattributed cash from a writing-advisor drill-down', () => {
    const snapshot: WritingCommissionSnapshotView = {
      viewer: 'owner',
      applicationId: 'app-1',
      accounts: [
        {
          accountId: 'acct-a',
          advisorId: 'adv-a',
          allocationId: 'alloc-a',
          expectedCentsPinned: 75000,
          events: [],
          reconciliation: {
            expected_cents: 75000,
            gross_paid_cents: 75000,
            adjustment_cents: 0,
            chargeback_cents: 0,
            recovery_cents: 0,
            net_actual_cents: 75000,
            remaining_expected_cents: 0,
            variance_cents: 0,
          },
        },
        {
          accountId: 'acct-b',
          advisorId: 'adv-b',
          allocationId: 'alloc-b',
          expectedCentsPinned: 25000,
          events: [],
          reconciliation: {
            expected_cents: 25000,
            gross_paid_cents: 0,
            adjustment_cents: 0,
            chargeback_cents: 0,
            recovery_cents: 0,
            net_actual_cents: 0,
            remaining_expected_cents: 25000,
            variance_cents: -25000,
          },
        },
      ],
      unattributedEvents: [
        {
          id: 'u1',
          event_type: 'paid',
          amount_cents: 5000,
          transaction_date: '2026-08-01',
          statement_identifier: null,
          policy_reference: null,
          source_file: null,
          source_row: null,
          reversed_event_id: null,
          import_batch_identifier: null,
          reason: 'review',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      totals: EMPTY_COMMISSION_TOTALS,
    }
    const sliced = snapshotForCommissionWorkItem(snapshot, {
      advisorId: 'adv-a',
      kind: 'writing_advisor',
    })
    expect(sliced.accounts).toHaveLength(1)
    expect(sliced.accounts[0]?.advisorId).toBe('adv-a')
    expect(sliced.unattributedEvents).toEqual([])
    expect(sliced.totals.net_actual_cents).toBe(75000)
  })
})
