import { canRecordAttributedActual } from './commissionWriteView'
import type { CommissionWorkItem } from './commissionWorkView'

type CommissionOwnerActionsProps = {
  isOwner: boolean
  item: CommissionWorkItem
  onRecord: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
}

export default function CommissionOwnerActions({
  isOwner,
  item,
  onRecord,
  onPreIssue,
}: CommissionOwnerActionsProps) {
  if (!canRecordAttributedActual(isOwner, item)) return null
  return (
    <div className="crm-commissions-owner-actions">
      <button type="button" className="crm-primary-btn" onClick={() => onRecord(item)}>
        Record actual
      </button>
      <button type="button" className="crm-secondary-btn" onClick={() => onPreIssue(item)}>
        Record pre-issue actual
      </button>
    </div>
  )
}
