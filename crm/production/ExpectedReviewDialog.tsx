import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../constants/routes'
import type { ExpectedReviewListItem } from './advisorCompensationView'
import { formatCents } from './productionApi'

type ExpectedReviewDialogProps = {
  items: readonly ExpectedReviewListItem[]
  title: string
  onClose: () => void
}

function moneyLabel(item: ExpectedReviewListItem): string {
  if (item.moneyKind === 'deposit') return `Annuity Deposit ${formatCents(item.moneyCents)}`
  if (item.moneyKind === 'annual_premium') {
    return `Annual Life Premium ${formatCents(item.moneyCents)}`
  }
  return '—'
}

export default function ExpectedReviewDialog({
  items,
  title,
  onClose,
}: ExpectedReviewDialogProps) {
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
        className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-production-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>{title}</h2>
          <button ref={closeRef} type="button" className="crm-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {items.length === 0 ? (
          <p className="crm-muted">No expected-compensation rows need review in this period.</p>
        ) : (
          <ul className="crm-production-review-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link to={crmProductionPath(item.applicationId)} className="crm-production-review-item">
                  <h3>{item.householdName}</h3>
                  <p>
                    App {item.applicationNumber ?? '—'}
                    {item.policyNumber ? ` · Policy ${item.policyNumber}` : ''}
                  </p>
                  <p>
                    {item.carrierName} · {item.productName}
                  </p>
                  <p>Writing advisor {item.advisorName}</p>
                  <p>Stage {item.stageLabel}</p>
                  <p>{moneyLabel(item)}</p>
                  <p className="crm-production-review-reason">{item.reviewReason}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
