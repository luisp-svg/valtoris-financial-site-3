import type { ReactNode } from 'react'
import {
  formatActualStatusLabel,
  formatCommissionEventTypeLabel,
} from './compensationLabels'
import {
  actualEmptyMessage,
  deriveActualStatus,
  formatSignedCents,
  presentEventReversal,
  type EventReversalPresentation,
  type WritingCommissionEvent,
} from './compensationView'
import type { WritingCommissionSnapshotView } from './compensationApi'
import { formatCents, formatProductionDate } from './productionApi'
import type { CompensationViewer } from './types'

type ActualCommissionPanelProps = {
  viewer: CompensationViewer
  snapshot: WritingCommissionSnapshotView | null
  loading: boolean
  error: string | null
  headerActions?: ReactNode
  formatEventSource?: (event: WritingCommissionEvent) => string
  renderEventActions?: (
    event: WritingCommissionEvent,
    reversal: EventReversalPresentation,
    unattributed: boolean,
  ) => ReactNode
}

export default function ActualCommissionPanel({
  viewer,
  snapshot,
  loading,
  error,
  headerActions,
  formatEventSource,
  renderEventActions,
}: ActualCommissionPanelProps) {
  const events = snapshot
    ? snapshot.accounts.flatMap((account) => account.events)
    : []
  const totals = snapshot?.totals ?? null
  const status = deriveActualStatus({
    totals,
    eventCount: events.length,
  })
  const empty = actualEmptyMessage({
    eventCount: events.length,
    expectedCents: totals?.expected_cents,
  })
  const canSeeUnattributed =
    viewer === 'owner' &&
    snapshot != null &&
    snapshot.viewer === 'owner' &&
    snapshot.unattributedEvents.length > 0

  return (
    <section className="crm-panel" aria-labelledby="pp-actual-heading">
      <div className="crm-panel-head">
        <h2 id="pp-actual-heading">Actual commission</h2>
        {headerActions}
      </div>

      {loading ? <p className="crm-muted">Loading actual commission…</p> : null}

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <p className="crm-production-comp-summary">
            <span className="crm-production-comp-badge">
              {formatActualStatusLabel(status.primary)}
            </span>
            {status.chargedBack ? (
              <span className="crm-production-comp-badge is-review">Charged back</span>
            ) : null}
          </p>

          {empty ? <p>{empty}</p> : null}

          <dl className="crm-production-detail-grid">
            <SummaryItem
              label="Expected"
              cents={totals?.expected_cents}
              unavailable={totals?.expected_cents == null}
            />
            <SummaryItem label="Gross paid" cents={totals?.gross_paid_cents ?? 0} signed />
            <SummaryItem label="Adjustments" cents={totals?.adjustment_cents ?? 0} signed />
            <SummaryItem label="Chargebacks" cents={totals?.chargeback_cents ?? 0} signed />
            <SummaryItem label="Recoveries" cents={totals?.recovery_cents ?? 0} signed />
            <SummaryItem label="Net actual" cents={totals?.net_actual_cents ?? 0} signed />
            <SummaryItem
              label="Remaining expected"
              cents={totals?.remaining_expected_cents}
              unavailable={totals?.expected_cents == null}
            />
            <SummaryItem
              label="Variance"
              cents={totals?.variance_cents}
              signed
              unavailable={totals?.expected_cents == null}
            />
          </dl>

          <h3 className="crm-production-comp-subheading">Commission history</h3>
          {events.length === 0 ? (
            <p className="crm-muted">No actual commission has been recorded yet.</p>
          ) : (
            <EventHistory
              events={events}
              formatEventSource={formatEventSource}
              renderEventActions={renderEventActions}
              unattributed={false}
            />
          )}

          {canSeeUnattributed ? (
            <>
              <h3 className="crm-production-comp-subheading">Unattributed</h3>
              <EventHistory
                events={snapshot.unattributedEvents}
                formatEventSource={formatEventSource}
                renderEventActions={renderEventActions}
                unattributed
              />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function SummaryItem({
  label,
  cents,
  signed = false,
  unavailable = false,
}: {
  label: string
  cents: number | null | undefined
  signed?: boolean
  unavailable?: boolean
}) {
  const display = unavailable ? '—' : signed ? formatSignedCents(cents) : formatCents(cents ?? null)
  return (
    <div>
      <dt>{label}</dt>
      <dd
        className={`crm-production-money${
          !unavailable && cents != null && cents < 0 ? ' is-negative' : ''
        }`}
      >
        {display}
      </dd>
      {unavailable && label === 'Expected' ? (
        <p className="crm-muted">Expected compensation unavailable</p>
      ) : null}
    </div>
  )
}

function EventHistory({
  events,
  formatEventSource,
  renderEventActions,
  unattributed,
}: {
  events: readonly WritingCommissionEvent[]
  formatEventSource?: (event: WritingCommissionEvent) => string
  renderEventActions?: (
    event: WritingCommissionEvent,
    reversal: EventReversalPresentation,
    unattributed: boolean,
  ) => ReactNode
  unattributed: boolean
}) {
  const ordered = events.slice().sort((a, b) => {
    const aDate = a.transaction_date || a.created_at
    const bDate = b.transaction_date || b.created_at
    return aDate.localeCompare(bDate)
  })

  return (
    <ol className="crm-production-timeline">
      {ordered.map((event) => {
        const reversal = presentEventReversal(event, events)
        return (
          <li
            key={event.id}
            className={reversal.kind !== 'active' ? 'crm-production-event-reversed' : undefined}
          >
            <div className="crm-production-timeline-when">
              {formatProductionDate(event.transaction_date || event.created_at)}
            </div>
            <div>
              <strong>{formatCommissionEventTypeLabel(event.event_type)}</strong>{' '}
              <span
                className={`crm-production-money${
                  event.amount_cents < 0 ? ' is-negative' : ''
                }`}
              >
                {formatSignedCents(event.amount_cents)}
              </span>
            </div>
            {reversal.kind === 'reversed' ? (
              <div>Reversed / corrected by a later reversal.</div>
            ) : null}
            {reversal.kind === 'reversal' ? (
              <div>Reversal of a prior commission event. Not added again into net actual.</div>
            ) : null}
            <div className="crm-muted">
              {formatEventSource
                ? formatEventSource(event)
                : [
                    event.statement_identifier ? `Statement ${event.statement_identifier}` : null,
                    event.policy_reference ? `Policy ${event.policy_reference}` : null,
                    event.source_file ? event.source_file : null,
                    event.source_row != null ? `Row ${event.source_row}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No source reference'}
            </div>
            {event.reason ? <div>Reason: {event.reason}</div> : null}
            {renderEventActions?.(event, reversal, unattributed)}
          </li>
        )
      })}
    </ol>
  )
}
