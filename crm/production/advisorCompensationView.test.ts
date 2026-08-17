import { describe, expect, it } from 'vitest'
import {
  buildAdvisorCompensationDashboard,
  expectedCompensationPeriodDate,
  isOutstandingProductionStage,
} from './advisorCompensationView'
import type { PaidCommissionListEvent } from './dashboardView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
  ProductionStage,
} from './types'

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
    expected_compensation_cents: 60000,
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
    application_number: null,
    policy_number: null,
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
    event_type: 'paid',
    amount_cents: 10000,
    reversed_event_id: null,
    transaction_date: '2026-08-10',
    ...partial,
  }
}

const TODAY = '2026-08-16'

function dashboard(
  items: ProductionApplicationListItem[],
  events: PaidCommissionListEvent[] = [],
  period: 'lifetime' | 'ytd' | 'this_month' = 'lifetime',
) {
  return buildAdvisorCompensationDashboard({ items, events, period, today: TODAY })
}

describe('advisor compensation dashboard', () => {
  it('breaks down by writing advisor and does not invent upline rows', () => {
    const model = dashboard([
      item({
        id: 'app-a',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({ id: 'e1', application_id: 'app-a', advisor_id: 'adv-a', expected_compensation_cents: 40000 }),
        ],
      }),
      item({
        id: 'app-b',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({
            id: 'e2',
            application_id: 'app-b',
            advisor_id: 'adv-b',
            advisor_display_name: 'Jordan Advisor',
            expected_compensation_cents: 15000,
          }),
        ],
      }),
    ])
    expect(model.rows.map((row) => row.advisorId)).toEqual(['adv-a', 'adv-b'])
    expect(model.rows[0]?.expectedCents).toBe(40000)
    expect(model.rows[1]?.expectedCents).toBe(15000)
    expect(model.rows.some((row) => /upline|generational|house/i.test(row.advisorName))).toBe(false)
  })

  it('omits unavailable and review_required expected dollars', () => {
    const model = dashboard([
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
            advisor_id: 'adv-a',
            calculation_status: 'review_required',
            review_reason: 'missing_compensation_base',
            expected_compensation_cents: null,
          }),
          expectedRow({
            id: 'na',
            application_id: 'app-1',
            advisor_id: 'adv-a',
            calculation_status: 'unavailable',
            expected_compensation_cents: 99999,
          }),
        ],
      }),
    ])
    expect(model.rows[0]?.expectedCents).toBe(50000)
    expect(model.rows[0]?.reviewCount).toBe(2)
  })

  it.each([
    'submitted',
    'paramed',
    'in_underwriting',
    'approved',
    'sent_to_draft',
    'premium_drafted',
    'issued',
    'in_force',
    'postponed',
  ] satisfies ProductionStage[])('includes %s in Outstanding', (stage) => {
    expect(isOutstandingProductionStage(stage)).toBe(true)
    const model = dashboard([
      item({
        id: 'live',
        production_stage: stage,
        expected_compensations: [
          expectedRow({ id: 'e', application_id: 'live', advisor_id: 'adv-a', expected_compensation_cents: 20000 }),
        ],
      }),
    ])
    expect(model.rows[0]?.outstandingCents).toBe(20000)
  })

  it.each(['declined', 'withdrawn', 'incomplete', 'not_taken', 'draft', 'pre_submitted'] satisfies ProductionStage[])(
    'excludes %s from Outstanding without mutating expected',
    (stage) => {
      const model = dashboard([
        item({
          id: 'gone',
          production_stage: stage,
          expected_compensations: [
            expectedRow({ id: 'e', application_id: 'gone', advisor_id: 'adv-a', expected_compensation_cents: 20000 }),
          ],
        }),
      ])
      expect(model.rows[0]?.expectedCents).toBe(20000)
      expect(model.rows[0]?.outstandingCents).toBe(0)
    },
  )

  it('reduces Outstanding by all-time net actual and never goes negative', () => {
    const model = dashboard(
      [
        item({
          id: 'app-1',
          production_stage: 'submitted',
          expected_compensations: [
            expectedRow({ id: 'e', application_id: 'app-1', advisor_id: 'adv-a', expected_compensation_cents: 50000 }),
          ],
        }),
      ],
      [
        event({ id: 'p1', application_id: 'app-1', amount_cents: 40000, transaction_date: '2026-01-01' }),
        event({ id: 'p2', application_id: 'app-1', amount_cents: 30000, transaction_date: '2026-08-02' }),
      ],
    )
    expect(model.rows[0]?.outstandingCents).toBe(0)
    expect(model.rows[0]?.expectedCents).toBe(50000)
  })

  it('does not let a chargeback resurrect a failed case into Outstanding', () => {
    const model = dashboard(
      [
        item({
          id: 'dead',
          production_stage: 'declined',
          expected_compensations: [
            expectedRow({ id: 'e', application_id: 'dead', advisor_id: 'adv-a', expected_compensation_cents: 50000 }),
          ],
        }),
      ],
      [event({ id: 'cb', application_id: 'dead', event_type: 'chargeback', amount_cents: -20000 })],
    )
    expect(model.rows[0]?.outstandingCents).toBe(0)
    expect(model.rows[0]?.chargebackCents).toBe(-20000)
  })

  it('counts active paid events and excludes reversed paid and reversed chargebacks', () => {
    const events: PaidCommissionListEvent[] = [
      event({ id: 'p1', application_id: 'app-1', amount_cents: 25000 }),
      event({
        id: 'rev-p',
        application_id: 'app-1',
        event_type: 'reversal',
        amount_cents: -25000,
        reversed_event_id: 'p1',
      }),
      event({ id: 'p2', application_id: 'app-1', amount_cents: 18000 }),
      event({ id: 'cb1', application_id: 'app-1', event_type: 'chargeback', amount_cents: -4000 }),
      event({
        id: 'rev-cb',
        application_id: 'app-1',
        event_type: 'reversal',
        amount_cents: 4000,
        reversed_event_id: 'cb1',
      }),
      event({ id: 'cb2', application_id: 'app-1', event_type: 'chargeback', amount_cents: -1500 }),
    ]
    const model = dashboard(
      [
        item({
          id: 'app-1',
          production_stage: 'issued',
          expected_compensations: [
            expectedRow({ id: 'e', application_id: 'app-1', advisor_id: 'adv-a', expected_compensation_cents: 50000 }),
          ],
        }),
      ],
      events,
    )
    expect(model.rows[0]?.paidCents).toBe(18000)
    expect(model.rows[0]?.chargebackCents).toBe(-1500)
    expect(model.rows[0]?.netPaidCents).toBe(16500)
  })

  it('uses 035 ledger signs for Net Paid including adjustment and recovery', () => {
    const model = dashboard(
      [item({ id: 'app-1', production_stage: 'in_force' })],
      [
        event({ id: 'p', application_id: 'app-1', amount_cents: 60000 }),
        event({ id: 'adj', application_id: 'app-1', event_type: 'adjustment', amount_cents: -1500 }),
        event({ id: 'cb', application_id: 'app-1', event_type: 'chargeback', amount_cents: -10000 }),
        event({ id: 'rc', application_id: 'app-1', event_type: 'recovery', amount_cents: 4000 }),
      ],
    )
    expect(model.rows[0]?.netPaidCents).toBe(60000 - 1500 - 10000 + 4000)
    expect(model.rows[0]?.paidCents).toBe(60000)
    expect(model.rows[0]?.chargebackCents).toBe(-10000)
  })

  it('periodizes Paid by transaction_date and Expected/Outstanding by submission_date else issue_date', () => {
    expect(
      expectedCompensationPeriodDate({ submission_date: '2026-08-01', issue_date: '2026-09-01' }),
    ).toBe('2026-08-01')
    expect(expectedCompensationPeriodDate({ submission_date: null, issue_date: '2026-09-01' })).toBe(
      '2026-09-01',
    )
    const items = [
      item({
        id: 'old-case',
        production_stage: 'submitted',
        submission_date: '2025-11-01',
        expected_compensations: [
          expectedRow({
            id: 'e-old',
            application_id: 'old-case',
            advisor_id: 'adv-a',
            expected_compensation_cents: 11111,
          }),
        ],
      }),
      item({
        id: 'new-case',
        production_stage: 'submitted',
        submission_date: '2026-08-02',
        expected_compensations: [
          expectedRow({
            id: 'e-new',
            application_id: 'new-case',
            advisor_id: 'adv-a',
            expected_compensation_cents: 22222,
          }),
        ],
      }),
    ]
    const events = [
      event({ id: 'old-pay', application_id: 'old-case', amount_cents: 3000, transaction_date: '2025-11-15' }),
      event({ id: 'month-pay', application_id: 'old-case', amount_cents: 7000, transaction_date: '2026-08-12' }),
    ]
    const month = dashboard(items, events, 'this_month')
    expect(month.rows[0]?.expectedCents).toBe(22222)
    expect(month.rows[0]?.paidCents).toBe(7000)
    const ytd = dashboard(items, events, 'ytd')
    expect(ytd.rows[0]?.expectedCents).toBe(22222)
    expect(ytd.rows[0]?.paidCents).toBe(7000)
    const lifetime = dashboard(items, events, 'lifetime')
    expect(lifetime.rows[0]?.expectedCents).toBe(33333)
    expect(lifetime.rows[0]?.paidCents).toBe(10000)
  })

  it('keeps writing splits on their own advisor rows', () => {
    const model = dashboard([
      item({
        id: 'split',
        production_stage: 'approved',
        expected_compensations: [
          expectedRow({
            id: 'a',
            application_id: 'split',
            advisor_id: 'adv-a',
            expected_compensation_cents: 30000,
          }),
          expectedRow({
            id: 'b',
            application_id: 'split',
            advisor_id: 'adv-b',
            advisor_display_name: 'Jordan Advisor',
            expected_compensation_cents: 20000,
          }),
        ],
      }),
    ])
    expect(model.rows).toHaveLength(2)
    expect(model.rows.find((row) => row.advisorId === 'adv-a')?.expectedCents).toBe(30000)
    expect(model.rows.find((row) => row.advisorId === 'adv-b')?.expectedCents).toBe(20000)
  })

  it('does not expose another advisor when only one advisor’s rows are present (RLS-shaped input)', () => {
    const model = dashboard([
      item({
        id: 'mine',
        production_stage: 'submitted',
        expected_compensations: [
          expectedRow({ id: 'e', application_id: 'mine', advisor_id: 'adv-a', expected_compensation_cents: 12000 }),
        ],
      }),
    ])
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]?.advisorId).toBe('adv-a')
  })
})
