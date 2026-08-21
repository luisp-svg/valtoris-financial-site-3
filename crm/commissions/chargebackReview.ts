/**
 * Chargeback review helpers over existing 035 events.
 * Totals stay on the work-item snapshot; this only groups history.
 * Does not invent a paid-event foreign key.
 */
import type { WritingCommissionEvent } from '../production/compensationView'
import type { CommissionWorkItem } from './commissionWorkView'

export const CHARGEBACK_LIFECYCLE_NOTE =
  'A chargeback is a carrier commission fact. Canceled, surrendered, or other policy lifecycle changes do not create a chargeback.'

export const CHARGEBACK_PAID_HISTORY_NOTE =
  'Original paid events stay in history. Chargebacks are separate negative events and do not rewrite paid amounts.'

export function eventsOfType(
  events: readonly WritingCommissionEvent[],
  eventType: WritingCommissionEvent['event_type'],
): WritingCommissionEvent[] {
  return events.filter((event) => event.event_type === eventType)
}

export function chargebackReviewTotals(
  item: Pick<
    CommissionWorkItem,
    'paidCents' | 'chargebackCents' | 'adjustmentCents' | 'recoveryCents' | 'netPaidCents'
  >,
) {
  return {
    paidCents: item.paidCents,
    chargebackCents: item.chargebackCents,
    adjustmentCents: item.adjustmentCents,
    recoveryCents: item.recoveryCents,
    netPaidCents: item.netPaidCents,
  }
}
