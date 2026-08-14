import { useEffect, useId, useRef, type FormEvent } from 'react'

export type CatalogDeactivateDialogProps = {
  kind: 'carrier' | 'product'
  name: string
  title: string
  body: string[]
  confirmLabel: string
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export default function CatalogDeactivateDialog({
  kind,
  name,
  title,
  body,
  confirmLabel,
  submitting,
  error,
  onCancel,
  onConfirm,
}: CatalogDeactivateDialogProps) {
  const headingId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    onConfirm()
  }

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-catalog-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-kind={kind}
      data-name={name}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{title}</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
      {body.map((paragraph) => (
        <p key={paragraph} className="crm-muted">
          {paragraph}
        </p>
      ))}
      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className="crm-form-actions">
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Keep active
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className="crm-primary-btn"
            disabled={submitting}
          >
            {submitting ? 'Deactivating…' : confirmLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
