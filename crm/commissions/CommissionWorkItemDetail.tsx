import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES, crmProductionPath } from '../../constants/routes'
import ActualCommissionPanel from '../production/ActualCommissionPanel'
import type { WritingCommissionSnapshotView } from '../production/compensationApi'
import { formatCents, formatProductionDate } from '../production/productionApi'
import type { CompensationViewer } from '../production/types'
import {
  formatSignedCents,
  type EventReversalPresentation,
  type WritingCommissionEvent,
} from '../production/compensationView'
import { formatCommissionEventSourceLabel } from './commissionEventSource'
import CommissionOwnerActions from './CommissionOwnerActions'
import type { CommissionWorkItem } from './commissionWorkView'
import {
  commissionExceptionNotes,
  formatCommissionReconciliationLabel,
  varianceCentsDisplay,
  varianceCentsForWorkItem,
} from './commissionExceptionView'
import {
  CHARGEBACK_LIFECYCLE_NOTE,
  CHARGEBACK_PAID_HISTORY_NOTE,
  chargebackReviewTotals,
  eventsOfType,
} from './chargebackReview'
import {
  PENDING_AND_PAID_COEXISTENCE_COPY,
  PENDING_IS_NOT_PAID_COPY,
  pendingPaymentShowsCoexistence,
  remainingExpectedDisplay,
} from './commissionPendingPayment'
import {
  canAttributeCommissionEvent,
  canReverseCommissionEvent,
} from './commissionWriteView'
import { formatCommissionEventTypeLabel } from '../production/compensationLabels'

type CommissionWorkItemDetailProps = {
  item: CommissionWorkItem
  viewer: CompensationViewer
  isOwner: boolean
  snapshot: WritingCommissionSnapshotView | null
  loading: boolean
  error: string | null
  closeOnEscape?: boolean
  onClose: () => void
  onRecord: (item: CommissionWorkItem) => void
  onChargeback: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
  onRecordPayment: (item: CommissionWorkItem) => void
  onReverse: (item: CommissionWorkItem, event: WritingCommissionEvent) => void
  onAttribute: (item: CommissionWorkItem, event: WritingCommissionEvent) => void
}

export default function CommissionWorkItemDetail({
  item,
  viewer,
  isOwner,
  snapshot,
  loading,
  error,
  closeOnEscape = true,
  onClose,
  onRecord,
  onChargeback,
  onPreIssue,
  onRecordPayment,
  onReverse,
  onAttribute,
}: CommissionWorkItemDetailProps) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!closeOnEscape) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, closeOnEscape])

  const allEvents = snapshot
    ? [...snapshot.accounts.flatMap((account) => account.events), ...snapshot.unattributedEvents]
    : []

  function renderEventActions(
    event: WritingCommissionEvent,
    _reversal: EventReversalPresentation,
    unattributed: boolean,
  ) {
    const actions = []
    if (canReverseCommissionEvent({
      isOwner,
      event,
      allEvents,
      pendingOnlyStub: item.pendingOnlyStub,
    })) {
      actions.push(
        <button
          key="reverse"
          type="button"
          className="crm-secondary-btn"
          onClick={() => onReverse(item, event)}
        >
          Reverse
        </button>,
      )
    }
    if (
      canAttributeCommissionEvent({
        isOwner,
        unattributed,
        event,
        allEvents: snapshot?.unattributedEvents ?? [],
        pendingOnlyStub: item.pendingOnlyStub,
      })
    ) {
      actions.push(
        <button
          key="attribute"
          type="button"
          className="crm-primary-btn"
          onClick={() => onAttribute(item, event)}
        >
          Attribute
        </button>,
      )
    }
    if (actions.length === 0) return null
    return <div className="crm-commissions-event-actions">{actions}</div>
  }

  const exceptionNotes = commissionExceptionNotes(item, isOwner)

  return (
    <div className="crm-production-review-overlay">
      <section
        className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-commissions-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>
            {item.clientLabel}
            <span className="crm-muted"> · {item.advisorName}</span>
          </h2>
          <button ref={closeRef} type="button" className="crm-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p>
          {item.referenceLabel} · {item.providerLabel} · {item.productServiceLabel}
        </p>
        {item.reviewReason ? <p className="crm-production-review-reason">{item.reviewReason}</p> : null}
        <p>
          <Link to={crmProductionPath(item.applicationId)}>Open production record</Link>
        </p>
        <h3 className="crm-production-comp-subheading">Reconciliation</h3>
        <dl className="crm-production-detail-grid" aria-label="Reconciliation">
          <div>
            <dt>Expected</dt>
            <dd className="crm-production-money">
              {item.expectedCents == null ? '—' : formatCents(item.expectedCents)}
            </dd>
          </div>
          {isOwner ? (
            <div>
              <dt>Pending</dt>
              <dd className="crm-production-money">{formatCents(item.pendingCents)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Net actual</dt>
            <dd
              className={`crm-production-money${item.netPaidCents < 0 ? ' is-negative' : ''}`}
            >
              {formatSignedCents(item.netPaidCents)}
            </dd>
          </div>
          <div>
            <dt>Remaining expected</dt>
            <dd className="crm-production-money">
              {remainingExpectedDisplay(item.remainingExpectedCents)}
            </dd>
          </div>
          <div>
            <dt>Variance</dt>
            <dd className="crm-production-money">
              {varianceCentsDisplay(varianceCentsForWorkItem(item))}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatCommissionReconciliationLabel(item)}</dd>
          </div>
        </dl>
        {exceptionNotes.length > 0 ? (
          <section className="crm-commissions-exceptions" aria-label="Exceptions">
            <h3 className="crm-production-comp-subheading">Exceptions</h3>
            <ul className="crm-commissions-exception-list">
              {exceptionNotes.map((note) => (
                <li key={`${note.bucket}:${note.title}`}>
                  <strong>{note.title}</strong>
                  <p className="crm-production-kpi-caption">{note.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {isOwner && item.pendingSource ? (
          <section className="crm-commissions-pending-source" aria-label="Pending source">
            <h3>Pending</h3>
            <p className="crm-production-kpi-caption">
              Source-confirmed Experior pending writing compensation. This is not Paid.
            </p>
            {pendingPaymentShowsCoexistence(item) ? (
              <p className="crm-production-kpi-caption">{PENDING_AND_PAID_COEXISTENCE_COPY}</p>
            ) : (
              <p className="crm-production-kpi-caption">{PENDING_IS_NOT_PAID_COPY}</p>
            )}
            <dl className="crm-production-detail-grid">
              <div>
                <dt>Current Pending</dt>
                <dd className="crm-production-money">{formatCents(item.pendingSource.amountCents)}</dd>
              </div>
              <div>
                <dt>Advisor</dt>
                <dd>{item.pendingSource.advisorName}</dd>
              </div>
              <div>
                <dt>Client</dt>
                <dd>{item.pendingSource.client || item.clientLabel}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{item.pendingSource.policyNumber || item.referenceLabel}</dd>
              </div>
              <div>
                <dt>Carrier / product</dt>
                <dd>
                  {item.pendingSource.company || item.providerLabel}
                  {item.pendingSource.product ? ` · ${item.pendingSource.product}` : ''}
                </dd>
              </div>
              <div>
                <dt>Statement</dt>
                <dd>{item.pendingSource.statementIdentifier || '—'}</dd>
              </div>
              <div>
                <dt>Statement date</dt>
                <dd>{formatProductionDate(item.pendingSource.statementDate)}</dd>
              </div>
              <div>
                <dt>Source file</dt>
                <dd>{item.pendingSource.sourceFile || '—'}</dd>
              </div>
              <div>
                <dt>Source transaction date</dt>
                <dd>{formatProductionDate(item.pendingSource.transactionDate)}</dd>
              </div>
            </dl>
            <p>
              <Link to={ROUTES.crmCommissionsPendingImport}>Open Pending import</Link>
            </p>
          </section>
        ) : isOwner && item.pendingCents === 0 ? (
          <p className="crm-muted">No accepted Pending for this writing allocation.</p>
        ) : null}
        {item.chargebackCents !== 0 || eventsOfType(allEvents, 'chargeback').length > 0 ? (
          <section className="crm-commissions-chargeback-review" aria-label="Chargeback review">
            <h3>Chargebacks</h3>
            <p className="crm-production-kpi-caption">{CHARGEBACK_LIFECYCLE_NOTE}</p>
            <p className="crm-production-kpi-caption">{CHARGEBACK_PAID_HISTORY_NOTE}</p>
            <dl className="crm-production-detail-grid">
              <div>
                <dt>Gross paid</dt>
                <dd className="crm-production-money">
                  {formatCents(chargebackReviewTotals(item).paidCents)}
                </dd>
              </div>
              <div>
                <dt>Chargebacks</dt>
                <dd className="crm-production-money is-negative">
                  {formatSignedCents(chargebackReviewTotals(item).chargebackCents)}
                </dd>
              </div>
              <div>
                <dt>Adjustments</dt>
                <dd className="crm-production-money">
                  {formatSignedCents(chargebackReviewTotals(item).adjustmentCents)}
                </dd>
              </div>
              <div>
                <dt>Net paid</dt>
                <dd className="crm-production-money">
                  {formatSignedCents(chargebackReviewTotals(item).netPaidCents)}
                </dd>
              </div>
            </dl>
            <h4 className="crm-production-comp-subheading">Paid history on this record</h4>
            {eventsOfType(allEvents, 'paid').length === 0 ? (
              <p className="crm-muted">No paid events are on this writing record.</p>
            ) : (
              <ul className="crm-commissions-chargeback-history">
                {eventsOfType(allEvents, 'paid').map((event) => (
                  <li key={event.id}>
                    {formatCommissionEventTypeLabel(event.event_type)}{' '}
                    {formatSignedCents(event.amount_cents)}
                    {event.transaction_date ? ` · ${formatProductionDate(event.transaction_date)}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <h4 className="crm-production-comp-subheading">Chargeback events</h4>
            <ul className="crm-commissions-chargeback-history">
              {eventsOfType(allEvents, 'chargeback').map((event) => (
                <li key={event.id}>
                  {formatCommissionEventTypeLabel(event.event_type)}{' '}
                  {formatSignedCents(event.amount_cents)}
                  {event.transaction_date ? ` · ${formatProductionDate(event.transaction_date)}` : ''}
                  {event.reason ? ` · ${event.reason}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-label="Activity">
          <ActualCommissionPanel
            viewer={viewer}
            snapshot={snapshot}
            loading={loading}
            error={error}
            headerActions={
              <CommissionOwnerActions
                isOwner={isOwner}
                item={item}
                onRecord={onRecord}
                onChargeback={onChargeback}
                onPreIssue={onPreIssue}
                onRecordPayment={onRecordPayment}
              />
            }
            formatEventSource={formatCommissionEventSourceLabel}
            renderEventActions={
              isOwner && !item.pendingOnlyStub ? renderEventActions : undefined
            }
          />
        </section>
      </section>
    </div>
  )
}
