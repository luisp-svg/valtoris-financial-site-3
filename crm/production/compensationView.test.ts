import { describe, expect, it } from 'vitest'
import { formatCents } from './productionApi'
import type { LiveExpectedCompensationRow, ProductionAllocation } from './types'
import {
  actualEmptyMessage,
  countCurrentWritingAdvisors,
  deriveActualStatus,
  deriveExpectedListPresentation,
  expectedEmptyMessage,
  formatListExpectedAmount,
  formatSignedCents,
  isWritingSplit,
  listExpectedAmountCaption,
  presentEventReversal,
  type WritingCommissionEvent,
  type WritingCommissionTotals,
} from './compensationView'

function expectedRow(
  partial: Partial<LiveExpectedCompensationRow> & Pick<LiveExpectedCompensationRow, 'id'>,
): LiveExpectedCompensationRow {
  return {
    application_id: 'app-1',
    allocation_id: `alloc-${partial.id}`,
    advisor_id: `adv-${partial.id}`,
    advisor_display_name: `Advisor ${partial.id}`,
    writing_contract_level: 'FA',
    writing_rate: '0.0125',
    compensation_base_cents: 100000,
    commission_bps: 10000,
    expected_compensation_cents: 60000,
    calculation_status: 'resolved',
    review_reason: null,
    calculated_at: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function writingAlloc(id: string, advisorId: string): ProductionAllocation {
  return {
    id,
    recipient_type: 'advisor',
    advisor_id: advisorId,
    allocation_role: 'writing',
    commission_bps: 5000,
    production_credit_bps: 5000,
    effective_to: null,
    advisor: { id: advisorId, display_name: advisorId },
  }
}

function totals(partial: Partial<WritingCommissionTotals> = {}): WritingCommissionTotals {
  return {
    expected_cents: 60000,
    gross_paid_cents: 0,
    adjustment_cents: 0,
    chargeback_cents: 0,
    recovery_cents: 0,
    net_actual_cents: 0,
    remaining_expected_cents: 60000,
    variance_cents: -60000,
    ...partial,
  }
}

function event(
  partial: Partial<WritingCommissionEvent> & Pick<WritingCommissionEvent, 'id' | 'event_type' | 'amount_cents'>,
): WritingCommissionEvent {
  return {
    transaction_date: '2026-08-01',
    statement_identifier: 'STMT-1',
    policy_reference: 'POL-1',
    source_file: 'stmt.csv',
    source_row: 2,
    reversed_event_id: null,
    import_batch_identifier: 'batch-1',
    reason: 'Carrier statement',
    created_at: '2026-08-01T12:00:00.000Z',
    ...partial,
  }
}

describe('expected list presentation', () => {
  it('treats draft/pre_submitted with no row as not calculated', () => {
    for (const productionStage of ['draft', 'pre_submitted'] as const) {
      const presentation = deriveExpectedListPresentation({
        viewer: 'owner',
        productionStage,
        liveRows: [],
        writingAdvisorCount: 1,
      })
      expect(presentation).toMatchObject({
        status: 'not_calculated',
        amountCents: null,
        amountKind: 'none',
        review: false,
      })
      expect(formatListExpectedAmount(presentation)).toBe('—')
      expect(formatListExpectedAmount(presentation)).not.toBe(formatCents(0))
      expect(
        expectedEmptyMessage({ productionStage, liveRows: [], status: presentation.status }),
      ).toBe('Expected compensation will be calculated after submission.')
    }
  })

  it('explains historical book with no current writing receivable', () => {
    expect(
      expectedEmptyMessage({
        productionStage: 'in_force',
        liveRows: [],
        status: 'not_calculated',
        writingReceivableExpected: false,
      }),
    ).toBe('Valtoris does not currently expect writing compensation on this application.')
  })

  it('shows owner resolved case total and advisor own expected only', () => {
    const ownerRows = [
      expectedRow({ id: 'a', advisor_id: 'adv-a', expected_compensation_cents: 60000 }),
      expectedRow({ id: 'b', advisor_id: 'adv-b', expected_compensation_cents: 20000 }),
    ]
    const owner = deriveExpectedListPresentation({
      viewer: 'owner',
      productionStage: 'submitted',
      liveRows: ownerRows,
      writingAdvisorCount: 2,
    })
    expect(owner).toMatchObject({
      status: 'expected',
      amountCents: 80000,
      amountKind: 'case_total',
      split: true,
      review: false,
    })
    expect(formatListExpectedAmount(owner)).toBe(formatCents(80000))
    expect(listExpectedAmountCaption(owner)).toBeNull()

    const advisor = deriveExpectedListPresentation({
      viewer: 'advisor',
      productionStage: 'submitted',
      liveRows: [ownerRows[0]],
      writingAdvisorCount: 2,
    })
    expect(advisor).toMatchObject({
      status: 'expected',
      amountCents: 60000,
      amountKind: 'your_expected',
      split: true,
    })
    expect(formatListExpectedAmount(advisor)).toBe(formatCents(60000))
    expect(listExpectedAmountCaption(advisor)).toBe('Your expected')
    expect(advisor.amountCents).not.toBe(owner.amountCents)
  })

  it('never labels advisor-visible money as a case total, even if two rows were present', () => {
    const leaked = deriveExpectedListPresentation({
      viewer: 'advisor',
      productionStage: 'submitted',
      liveRows: [
        expectedRow({ id: 'a', expected_compensation_cents: 60000 }),
        expectedRow({ id: 'b', expected_compensation_cents: 20000 }),
      ],
      writingAdvisorCount: 2,
    })
    expect(leaked.amountKind).toBe('your_expected')
    expect(leaked.amountKind).not.toBe('case_total')
    expect(listExpectedAmountCaption(leaked)).toBe('Your expected')
  })

  it('keeps NULL expected as an em dash, never $0', () => {
    const presentation = deriveExpectedListPresentation({
      viewer: 'owner',
      productionStage: 'submitted',
      liveRows: [
        expectedRow({
          id: 'a',
          calculation_status: 'unavailable',
          expected_compensation_cents: null,
          review_reason: 'no_rate_card',
        }),
      ],
      writingAdvisorCount: 1,
    })
    expect(presentation.amountCents).toBeNull()
    expect(formatListExpectedAmount(presentation)).toBe('—')
    expect(formatListExpectedAmount(presentation)).not.toBe(formatCents(0))
  })

  it('maps review_required and unavailable to derived UI states', () => {
    const review = deriveExpectedListPresentation({
      viewer: 'owner',
      productionStage: 'submitted',
      liveRows: [
        expectedRow({
          id: 'a',
          calculation_status: 'review_required',
          expected_compensation_cents: null,
          review_reason: 'age_sensitive_rate_card',
        }),
      ],
      writingAdvisorCount: 1,
    })
    expect(review.status).toBe('review_required')
    expect(review.review).toBe(true)
    expect(
      expectedEmptyMessage({
        productionStage: 'submitted',
        liveRows: [
          expectedRow({
            id: 'a',
            calculation_status: 'review_required',
            review_reason: 'age_sensitive_rate_card',
          }),
        ],
        status: 'review_required',
      }),
    ).toBe('Expected compensation needs review. Policy Production can continue.')

    const unavailable = deriveExpectedListPresentation({
      viewer: 'advisor',
      productionStage: 'submitted',
      liveRows: [
        expectedRow({
          id: 'a',
          calculation_status: 'unavailable',
          expected_compensation_cents: null,
          review_reason: 'no_rate_card',
        }),
      ],
      writingAdvisorCount: 1,
    })
    expect(unavailable.status).toBe('no_rate')
    expect(unavailable.review).toBe(true)
    expect(
      expectedEmptyMessage({
        productionStage: 'submitted',
        liveRows: [
          expectedRow({
            id: 'a',
            calculation_status: 'unavailable',
            review_reason: 'no_rate_card',
          }),
        ],
        status: 'no_rate',
      }),
    ).toBe('No compensation rate is currently available for this product.')
  })

  it('derives split from current writing-advisor allocations, not from money', () => {
    const splitAllocations = [writingAlloc('1', 'adv-a'), writingAlloc('2', 'adv-b')]
    expect(countCurrentWritingAdvisors(splitAllocations)).toBe(2)
    expect(isWritingSplit(splitAllocations)).toBe(true)
    expect(isWritingSplit([writingAlloc('1', 'adv-a')])).toBe(false)
    const presentation = deriveExpectedListPresentation({
      viewer: 'owner',
      productionStage: 'submitted',
      liveRows: [],
      writingAdvisorCount: 2,
    })
    expect(presentation.split).toBe(true)
    expect(presentation.amountCents).toBeNull()
  })
})

describe('actual commission presentation', () => {
  it('shows no payments when the ledger has no events', () => {
    expect(deriveActualStatus({ totals: totals(), eventCount: 0 }).primary).toBe('no_payments')
    expect(actualEmptyMessage({ eventCount: 0, expectedCents: 60000 })).toBe(
      'No actual commission has been recorded yet.',
    )
  })

  it('classifies fully paid, partial, overpaid, and net zero', () => {
    expect(
      deriveActualStatus({
        totals: totals({
          gross_paid_cents: 60000,
          net_actual_cents: 60000,
          remaining_expected_cents: 0,
          variance_cents: 0,
        }),
        eventCount: 1,
      }).primary,
    ).toBe('paid')

    expect(
      deriveActualStatus({
        totals: totals({
          gross_paid_cents: 30000,
          net_actual_cents: 30000,
          remaining_expected_cents: 30000,
          variance_cents: -30000,
        }),
        eventCount: 1,
      }).primary,
    ).toBe('partially_paid')

    expect(
      deriveActualStatus({
        totals: totals({
          gross_paid_cents: 70000,
          net_actual_cents: 70000,
          remaining_expected_cents: -10000,
          variance_cents: 10000,
        }),
        eventCount: 1,
      }).primary,
    ).toBe('overpaid')

    expect(
      deriveActualStatus({
        totals: totals({
          gross_paid_cents: 60000,
          chargeback_cents: -60000,
          net_actual_cents: 0,
          remaining_expected_cents: 60000,
          variance_cents: -60000,
        }),
        eventCount: 2,
      }),
    ).toEqual({ primary: 'net_zero', chargedBack: true })
  })

  it('preserves NULL expected with actual cash and does not coerce to $0', () => {
    const status = deriveActualStatus({
      totals: totals({
        expected_cents: null,
        gross_paid_cents: 40000,
        net_actual_cents: 40000,
        remaining_expected_cents: null,
        variance_cents: null,
      }),
      eventCount: 1,
    })
    expect(status.primary).toBe('expected_unavailable')
    expect(actualEmptyMessage({ eventCount: 1, expectedCents: null })).toBe(
      'Cash has been recorded, but expected compensation is unavailable. Variance is not calculated.',
    )
    expect(formatSignedCents(null)).toBe('—')
    expect(formatSignedCents(null)).not.toBe(formatCents(0))
  })

  it('formats signed event amounts with an explicit minus', () => {
    expect(formatSignedCents(60000)).toBe(`+${formatCents(60000)}`)
    expect(formatSignedCents(-30000)).toBe(`-${formatCents(30000)}`)
    expect(formatSignedCents(-30000)).toContain('-')
    expect(formatSignedCents(30000)).toBe(`+${formatCents(30000)}`)
    expect(formatSignedCents(-15000)).toMatch(/^-/)
  })

  it('keeps reversed originals visible and does not treat reversals as extra net math', () => {
    const paid = event({ id: 'e1', event_type: 'paid', amount_cents: 60000 })
    const reversal = event({
      id: 'e2',
      event_type: 'reversal',
      amount_cents: -60000,
      reversed_event_id: 'e1',
    })
    const chargeback = event({ id: 'e3', event_type: 'chargeback', amount_cents: -30000 })
    const recovery = event({ id: 'e4', event_type: 'recovery', amount_cents: 30000 })
    const adjustment = event({ id: 'e5', event_type: 'adjustment', amount_cents: -1500 })
    const all = [paid, reversal, chargeback, recovery, adjustment]

    expect(presentEventReversal(paid, all)).toEqual({ kind: 'reversed', reversalId: 'e2' })
    expect(presentEventReversal(reversal, all)).toEqual({ kind: 'reversal', originalId: 'e1' })
    expect(presentEventReversal(chargeback, all)).toEqual({ kind: 'active' })
    expect(presentEventReversal(recovery, all)).toEqual({ kind: 'active' })
    expect(presentEventReversal(adjustment, all)).toEqual({ kind: 'active' })
  })
})
