import { useEffect, useId, useRef } from 'react'
import OperationalNotesPanel from './OperationalNotesPanel'

type OperationalNotesDialogProps = {
  householdId: string
  householdName: string
  authorUserId: string | null
  onClose: () => void
}

export default function OperationalNotesDialog({
  householdId,
  householdName,
  authorUserId,
  onClose,
}: OperationalNotesDialogProps) {
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
        className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-operational-notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>Operational Notes — {householdName}</h2>
          <button ref={closeRef} type="button" className="crm-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <OperationalNotesPanel
          householdId={householdId}
          householdName={householdName}
          authorUserId={authorUserId}
        />
      </section>
    </div>
  )
}
