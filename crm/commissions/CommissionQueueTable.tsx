import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatSignedCents } from '../production/compensationView'
import type { CommissionWorkItem } from './commissionWorkView'
import { formatCommissionWorkStatusLabel } from './commissionWorkView'

type CommissionQueueTableProps = {
  items: readonly CommissionWorkItem[]
  onOpenItem: (item: CommissionWorkItem) => void
}

export default function CommissionQueueTable({ items, onOpenItem }: CommissionQueueTableProps) {
  return (
    <div className="crm-opportunities-table-wrap" role="region" aria-label="Commission work queue">
      <table className="crm-opportunities-table crm-commissions-queue-table">
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Reference</th>
            <th scope="col">Provider</th>
            <th scope="col">Product / Service</th>
            <th scope="col">Writing Advisor</th>
            <th scope="col">Expected</th>
            <th scope="col">Outstanding</th>
            <th scope="col">Paid</th>
            <th scope="col">Chargebacks</th>
            <th scope="col">Net Paid</th>
            <th scope="col">Status</th>
            <th scope="col">Needs Review</th>
            <th scope="col">Last financial activity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  className="crm-commissions-queue-open"
                  onClick={() => onOpenItem(item)}
                >
                  {item.clientLabel}
                </button>
              </td>
              <td>{item.referenceLabel}</td>
              <td>{item.providerLabel}</td>
              <td>{item.productServiceLabel}</td>
              <td>{item.advisorName}</td>
              <td className="crm-production-money">
                {item.expectedCents == null ? '—' : formatCents(item.expectedCents)}
              </td>
              <td className="crm-production-money">{formatCents(item.outstandingCents)}</td>
              <td className="crm-production-money">{formatCents(item.paidCents)}</td>
              <td
                className={`crm-production-money${item.chargebackCents < 0 ? ' is-negative' : ''}`}
              >
                {item.chargebackCents === 0
                  ? formatCents(0)
                  : formatSignedCents(item.chargebackCents)}
                {item.chargebackCents < 0 ? (
                  <span className="crm-commissions-chargeback-text"> Chargeback</span>
                ) : null}
              </td>
              <td
                className={`crm-production-money${item.netPaidCents < 0 ? ' is-negative' : ''}`}
              >
                {formatSignedCents(item.netPaidCents)}
              </td>
              <td>
                <span className="crm-production-comp-badge">
                  {formatCommissionWorkStatusLabel(item.derivedStatus.primary)}
                </span>
                {item.derivedStatus.chargedBack ? (
                  <span className="crm-production-comp-badge is-review">Charged back</span>
                ) : null}
              </td>
              <td>
                {item.derivedStatus.needsReview ? (
                  <span className="crm-production-comp-badge is-review">Needs review</span>
                ) : (
                  '—'
                )}
              </td>
              <td>{formatProductionDate(item.lastFinancialActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
