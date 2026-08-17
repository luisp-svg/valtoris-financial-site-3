import type {
  WritingCommissionSnapshotView,
  WritingCommissionAccountView,
} from '../production/compensationApi'
import { EMPTY_COMMISSION_TOTALS } from '../production/compensationApi'
import type { WritingCommissionEvent, WritingCommissionTotals } from '../production/compensationView'
import type { CommissionWorkKind } from './commissionWorkView'

function totalsFromEvents(events: readonly WritingCommissionEvent[]): WritingCommissionTotals {
  const reversedIds = new Set(
    events.filter((event) => event.event_type === 'reversal' && event.reversed_event_id).map(
      (event) => event.reversed_event_id as string,
    ),
  )
  let gross = 0
  let adjustment = 0
  let chargeback = 0
  let recovery = 0
  for (const event of events) {
    if (event.event_type === 'reversal') continue
    if (reversedIds.has(event.id)) continue
    if (event.event_type === 'paid') gross += event.amount_cents
    if (event.event_type === 'adjustment') adjustment += event.amount_cents
    if (event.event_type === 'chargeback') chargeback += event.amount_cents
    if (event.event_type === 'recovery') recovery += event.amount_cents
  }
  const net = gross + adjustment + chargeback + recovery
  return {
    expected_cents: null,
    gross_paid_cents: gross,
    adjustment_cents: adjustment,
    chargeback_cents: chargeback,
    recovery_cents: recovery,
    net_actual_cents: net,
    remaining_expected_cents: null,
    variance_cents: null,
  }
}

/**
 * Owner snapshots include every writer on the application. Queue drill-down
 * must stay at writing-advisor grain and never leak another writer's cash.
 */
export function snapshotForCommissionWorkItem(
  snapshot: WritingCommissionSnapshotView,
  options: { advisorId: string | null; kind: CommissionWorkKind },
): WritingCommissionSnapshotView {
  if (options.kind === 'unattributed') {
    return {
      ...snapshot,
      accounts: [],
      unattributedEvents: snapshot.viewer === 'owner' ? snapshot.unattributedEvents : [],
      totals: totalsFromEvents(
        snapshot.viewer === 'owner' ? snapshot.unattributedEvents : [],
      ),
    }
  }

  const accounts: WritingCommissionAccountView[] = snapshot.accounts.filter(
    (account) => account.advisorId === options.advisorId,
  )
  const account = accounts[0]
  return {
    ...snapshot,
    accounts,
    unattributedEvents: [],
    totals: account?.reconciliation ?? EMPTY_COMMISSION_TOTALS,
  }
}
