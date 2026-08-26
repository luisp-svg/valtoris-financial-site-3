import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatSignedCents } from '../production/compensationView'
import type { CommissionWorkItem } from './commissionWorkView'
import CommissionOwnerActions from './CommissionOwnerActions'
import { remainingExpectedDisplay } from './commissionPendingPayment'
import {
  commissionExceptionFlags,
  formatCommissionReconciliationLabel,
  PENDING_WITHOUT_ACTUAL_COPY,
  varianceCentsDisplay,
  varianceCentsForWorkItem,
} from './commissionExceptionView'

type CommissionQueueTableProps = {
  items: readonly CommissionWorkItem[]
  isOwner: boolean
  onOpenItem: (item: CommissionWorkItem) => void
  onRecord: (item: CommissionWorkItem) => void
  onChargeback: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
  onRecordPayment: (item: CommissionWorkItem) => void
}

export default function CommissionQueueTable({
  items,
  isOwner,
  onOpenItem,
  onRecord,
  onChargeback,
  onPreIssue,
  onRecordPayment,
}: CommissionQueueTableProps) {
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
            {isOwner ? <th scope="col">Pending</th> : null}
            <th scope="col">Outstanding</th>
            <th scope="col">Remaining expected</th>
            <th scope="col">Paid</th>
            <th scope="col">Chargebacks</th>
            <th scope="col">Net actual</th>
            <th scope="col">Variance</th>
            <th scope="col">Status</th>
            <th scope="col">{isOwner ? 'Needs attention' : 'Needs review'}</th>
            <th scope="col">Last financial activity</th>
            {isOwner ? <th scope="col">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const flags = commissionExceptionFlags(item, isOwner)
            return (
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
                {isOwner ? (
                  <td className="crm-production-money">{formatCents(item.pendingCents)}</td>
                ) : null}
                <td className="crm-production-money">{formatCents(item.outstandingCents)}</td>
                <td className="crm-production-money">
                  {remainingExpectedDisplay(item.remainingExpectedCents)}
                </td>
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
                <td className="crm-production-money">
                  {varianceCentsDisplay(varianceCentsForWorkItem(item))}
                </td>
                <td>
                  <span className="crm-production-comp-badge">
                    {formatCommissionReconciliationLabel(item)}
                  </span>
                  {flags.chargebackActivity ? (
                    <span className="crm-production-comp-badge is-review">Charged back</span>
                  ) : null}
                  {flags.pendingWithoutActual ? (
                    <span className="crm-production-comp-badge is-review">
                      {PENDING_WITHOUT_ACTUAL_COPY}
                    </span>
                  ) : null}
                </td>
                <td>
                  {flags.needsAttention ? (
                    <span className="crm-production-comp-badge is-review">
                      {isOwner ? 'Needs attention' : 'Needs review'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{formatProductionDate(item.lastFinancialActivity)}</td>
                {isOwner ? (
                  <td>
                    <CommissionOwnerActions
                      isOwner={isOwner}
                      item={item}
                      onRecord={onRecord}
                      onChargeback={onChargeback}
                      onPreIssue={onPreIssue}
                      onRecordPayment={onRecordPayment}
                    />
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
