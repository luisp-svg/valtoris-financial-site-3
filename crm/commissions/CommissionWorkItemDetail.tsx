import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../constants/routes'
import ActualCommissionPanel from '../production/ActualCommissionPanel'
import type { WritingCommissionSnapshotView } from '../production/compensationApi'
import type { CompensationViewer } from '../production/types'
import type { CommissionWorkItem } from './commissionWorkView'

type CommissionWorkItemDetailProps = {
  item: CommissionWorkItem
  viewer: CompensationViewer
  snapshot: WritingCommissionSnapshotView | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export default function CommissionWorkItemDetail({
  item,
  viewer,
  snapshot,
  loading,
  error,
  onClose,
}: CommissionWorkItemDetailProps) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        <ActualCommissionPanel
          viewer={viewer}
          snapshot={snapshot}
          loading={loading}
          error={error}
        />
      </section>
    </div>
  )
}
