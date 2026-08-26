import { canRecordAttributedActual, canRecordChargeback, RECORD_CHARGEBACK_ACTION_LABEL } from './commissionWriteView'
import {
  canRecordPendingPayment,
  RECORD_PAYMENT_ACTION_LABEL,
} from './commissionPendingPayment'
import type { CommissionWorkItem } from './commissionWorkView'

type CommissionOwnerActionsProps = {
  isOwner: boolean
  item: CommissionWorkItem
  onRecord: (item: CommissionWorkItem) => void
  onChargeback: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
  onRecordPayment?: (item: CommissionWorkItem) => void
}

export default function CommissionOwnerActions({
  isOwner,
  item,
  onRecord,
  onChargeback,
  onPreIssue,
  onRecordPayment,
}: CommissionOwnerActionsProps) {
  const showPendingPayment = Boolean(onRecordPayment) && canRecordPendingPayment(isOwner, item)
  const showGeneric = canRecordAttributedActual(isOwner, item)
  if (!showPendingPayment && !showGeneric) return null
  return (
    <div className="crm-commissions-owner-actions">
      {showPendingPayment ? (
        <button type="button" className="crm-primary-btn" onClick={() => onRecordPayment?.(item)}>
          {RECORD_PAYMENT_ACTION_LABEL}
        </button>
      ) : null}
      {showGeneric ? (
        <>
          <button
            type="button"
            className={showPendingPayment ? 'crm-secondary-btn' : 'crm-primary-btn'}
            onClick={() => onRecord(item)}
          >
            Record actual
          </button>
          {canRecordChargeback(isOwner, item) ? (
            <button type="button" className="crm-secondary-btn" onClick={() => onChargeback(item)}>
              {RECORD_CHARGEBACK_ACTION_LABEL}
            </button>
          ) : null}
          <button type="button" className="crm-secondary-btn" onClick={() => onPreIssue(item)}>
            Record pre-issue actual
          </button>
        </>
      ) : null}
    </div>
  )
}
