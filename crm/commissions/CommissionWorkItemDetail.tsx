import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES, crmProductionPath } from '../../constants/routes'
import ActualCommissionPanel from '../production/ActualCommissionPanel'
import type { WritingCommissionSnapshotView } from '../production/compensationApi'
import { formatCents, formatProductionDate } from '../production/productionApi'
import type { CompensationViewer } from '../production/types'
import type { EventReversalPresentation, WritingCommissionEvent } from '../production/compensationView'
import { formatCommissionEventSourceLabel } from './commissionEventSource'
import CommissionOwnerActions from './CommissionOwnerActions'
import type { CommissionWorkItem } from './commissionWorkView'
import {
  canAttributeCommissionEvent,
  canReverseCommissionEvent,
} from './commissionWriteView'

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
  onPreIssue: (item: CommissionWorkItem) => void
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
  onPreIssue,
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
        {isOwner && item.pendingSource ? (
          <section className="crm-commissions-pending-source" aria-label="Pending source">
            <h3>Pending</h3>
            <p className="crm-production-kpi-caption">
              Source-confirmed Experior pending writing compensation. This is not Paid.
            </p>
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
              onPreIssue={onPreIssue}
            />
          }
          formatEventSource={formatCommissionEventSourceLabel}
          renderEventActions={
            isOwner && !item.pendingOnlyStub ? renderEventActions : undefined
          }
        />
      </section>
    </div>
  )
}
