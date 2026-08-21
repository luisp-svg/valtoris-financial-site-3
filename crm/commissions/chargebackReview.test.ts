import { describe, expect, it } from 'vitest'
import {
  CHARGEBACK_LIFECYCLE_NOTE,
  CHARGEBACK_PAID_HISTORY_NOTE,
  chargebackReviewTotals,
  eventsOfType,
} from './chargebackReview'
import type { WritingCommissionEvent } from '../production/compensationView'

function event(
  partial: Partial<WritingCommissionEvent> & Pick<WritingCommissionEvent, 'id'>,
): WritingCommissionEvent {
  return {
    event_type: 'paid',
    amount_cents: 100000,
    transaction_date: '2026-08-15',
    statement_identifier: null,
    policy_reference: null,
    source_file: null,
    source_row: null,
    reversed_event_id: null,
    import_batch_identifier: null,
    reason: 'Carrier commission statement',
    created_at: '2026-08-15T12:00:00.000Z',
    idempotency_key: 'manual035:11111111-1111-4111-8111-111111111111',
    ...partial,
  }
}

describe('chargeback review helpers', () => {
  it('groups paid and chargeback history without inventing a paid-event foreign key', () => {
    const events = [
      event({ id: 'paid-1', amount_cents: 100000 }),
      event({ id: 'cb-1', event_type: 'chargeback', amount_cents: -40000 }),
      event({ id: 'adj-1', event_type: 'adjustment', amount_cents: -1000 }),
    ]
    expect(eventsOfType(events, 'paid').map((row) => row.id)).toEqual(['paid-1'])
    expect(eventsOfType(events, 'chargeback').map((row) => row.id)).toEqual(['cb-1'])
    expect(eventsOfType(events, 'adjustment').map((row) => row.id)).toEqual(['adj-1'])
    expect(chargebackReviewTotals({
      paidCents: 100000,
      chargebackCents: -40000,
      adjustmentCents: -1000,
      recoveryCents: 0,
      netPaidCents: 59000,
    })).toEqual({
      paidCents: 100000,
      chargebackCents: -40000,
      adjustmentCents: -1000,
      recoveryCents: 0,
      netPaidCents: 59000,
    })
    expect(CHARGEBACK_LIFECYCLE_NOTE).toMatch(/Canceled, surrendered/)
    expect(CHARGEBACK_PAID_HISTORY_NOTE).toMatch(/do not rewrite paid amounts/)
  })
})
