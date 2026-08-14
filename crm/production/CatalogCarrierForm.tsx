import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { canSubmitCatalogForm, validateCarrierDraft } from './catalogView'
import type { CatalogCarrier } from './types'

export type CatalogCarrierFormMode = 'create' | 'edit'

export type CatalogCarrierFormProps = {
  mode: CatalogCarrierFormMode
  carrier?: CatalogCarrier | null
  submitting: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: { code: string; name: string }) => void
}

export default function CatalogCarrierForm({
  mode,
  carrier = null,
  submitting,
  error,
  onCancel,
  onSubmit,
}: CatalogCarrierFormProps) {
  const headingId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState(carrier?.code ?? '')
  const [name, setName] = useState(carrier?.name ?? '')
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({})

  useEffect(() => {
    firstFieldRef.current?.focus()
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
    const draft = validateCarrierDraft({ code, name, mode })
    setFieldErrors(draft.fieldErrors)
    if (!canSubmitCatalogForm({ submitting, invalid: draft.invalid })) return
    onSubmit({ code: code.trim(), name: name.trim() })
  }

  const codeLocked = mode === 'edit'

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-catalog-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{mode === 'create' ? 'Add carrier' : 'Edit carrier'}</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>

      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="crm-opportunity-form" onSubmit={handleSubmit} noValidate>
        <label className="crm-field">
          <span>Carrier code</span>
          <input
            ref={firstFieldRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            required={mode === 'create'}
            disabled={submitting || codeLocked}
            readOnly={codeLocked}
            aria-readonly={codeLocked}
            aria-invalid={Boolean(fieldErrors.code)}
            autoComplete="off"
          />
          {codeLocked ? (
            <span className="crm-muted">Carrier code cannot be changed after creation.</span>
          ) : null}
          {fieldErrors.code ? <span className="crm-field-error">{fieldErrors.code}</span> : null}
        </label>

        <label className="crm-field">
          <span>Carrier name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.name)}
            autoComplete="off"
          />
          {fieldErrors.name ? <span className="crm-field-error">{fieldErrors.name}</span> : null}
        </label>

        <div className="crm-form-actions">
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="crm-primary-btn" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create carrier' : 'Save carrier'}
          </button>
        </div>
      </form>
    </section>
  )
}
