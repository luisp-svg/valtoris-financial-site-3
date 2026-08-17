import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatSignedCents } from '../production/compensationView'
import type { CommissionWorkItem } from './commissionWorkView'
import { formatCommissionWorkStatusLabel } from './commissionWorkView'
import CommissionOwnerActions from './CommissionOwnerActions'

type CommissionQueueCardsProps = {
  items: readonly CommissionWorkItem[]
  isOwner: boolean
  onOpenItem: (item: CommissionWorkItem) => void
  onRecord: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
}

export default function CommissionQueueCards({
  items,
  isOwner,
  onOpenItem,
  onRecord,
  onPreIssue,
}: CommissionQueueCardsProps) {
  return (
    <ul className="crm-opportunities-card-list" aria-label="Commission work queue cards">
      {items.map((item) => (
        <li key={item.id}>
          <article className="crm-panel crm-commissions-card">
            <div className="crm-panel-head">
              <h3>{item.clientLabel}</h3>
              <button type="button" className="crm-text-btn" onClick={() => onOpenItem(item)}>
                View
              </button>
            </div>
            <p>
              {item.referenceLabel} · {item.providerLabel}
            </p>
            <p>{item.productServiceLabel}</p>
            <p>Writing advisor {item.advisorName}</p>
            <p>
              <span className="crm-production-comp-badge">
                {formatCommissionWorkStatusLabel(item.derivedStatus.primary)}
              </span>
              {item.derivedStatus.chargedBack ? (
                <span className="crm-production-comp-badge is-review">Charged back</span>
              ) : null}
              {item.derivedStatus.needsReview ? (
                <span className="crm-production-comp-badge is-review">Needs review</span>
              ) : null}
            </p>
            <dl className="crm-production-detail-grid">
              <div>
                <dt>Expected</dt>
                <dd className="crm-production-money">
                  {item.expectedCents == null ? '—' : formatCents(item.expectedCents)}
                </dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd className="crm-production-money">{formatCents(item.outstandingCents)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd className="crm-production-money">{formatCents(item.paidCents)}</dd>
              </div>
              <div>
                <dt>Chargebacks</dt>
                <dd
                  className={`crm-production-money${
                    item.chargebackCents < 0 ? ' is-negative' : ''
                  }`}
                >
                  {item.chargebackCents === 0
                    ? formatCents(0)
                    : formatSignedCents(item.chargebackCents)}
                </dd>
              </div>
              <div>
                <dt>Net Paid</dt>
                <dd
                  className={`crm-production-money${item.netPaidCents < 0 ? ' is-negative' : ''}`}
                >
                  {formatSignedCents(item.netPaidCents)}
                </dd>
              </div>
              <div>
                <dt>Last financial activity</dt>
                <dd>{formatProductionDate(item.lastFinancialActivity)}</dd>
              </div>
            </dl>
            {item.reviewReason ? (
              <p className="crm-production-review-reason">{item.reviewReason}</p>
            ) : null}
            <CommissionOwnerActions
              isOwner={isOwner}
              item={item}
              onRecord={onRecord}
              onPreIssue={onPreIssue}
            />
          </article>
        </li>
      ))}
    </ul>
  )
}
