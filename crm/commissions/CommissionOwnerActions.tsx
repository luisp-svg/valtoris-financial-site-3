import { canRecordAttributedActual, canRecordChargeback, RECORD_CHARGEBACK_ACTION_LABEL } from './commissionWriteView'
import type { CommissionWorkItem } from './commissionWorkView'

type CommissionOwnerActionsProps = {
  isOwner: boolean
  item: CommissionWorkItem
  onRecord: (item: CommissionWorkItem) => void
  onChargeback: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
}

export default function CommissionOwnerActions({
  isOwner,
  item,
  onRecord,
  onChargeback,
  onPreIssue,
}: CommissionOwnerActionsProps) {
  if (!canRecordAttributedActual(isOwner, item)) return null
  return (
    <div className="crm-commissions-owner-actions">
      <button type="button" className="crm-primary-btn" onClick={() => onRecord(item)}>
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
    </div>
  )
}
