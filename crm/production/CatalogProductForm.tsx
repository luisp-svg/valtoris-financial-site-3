import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { formatCatalogProductLineLabel } from './labels'
import { activeCarriersForNewProducts, canSubmitCatalogForm, validateProductDraft } from './catalogView'
import { PRODUCTION_PRODUCT_LINES, type CatalogCarrier, type CatalogProduct, type ProductionProductLine } from './types'

export type CatalogProductFormMode = 'create' | 'edit'

export type CatalogProductFormProps = {
  mode: CatalogProductFormMode
  product?: CatalogProduct | null
  carriers: CatalogCarrier[]
  submitting: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: { carrierId: string; name: string; productLine: ProductionProductLine }) => void
}

export default function CatalogProductForm({
  mode,
  product = null,
  carriers,
  submitting,
  error,
  onCancel,
  onSubmit,
}: CatalogProductFormProps) {
  const headingId = useId()
  const firstFieldRef = useRef<HTMLSelectElement | HTMLInputElement>(null)
  const createCarriers = activeCarriersForNewProducts(carriers)
  const [carrierId, setCarrierId] = useState(product?.carrier_id ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [productLine, setProductLine] = useState<ProductionProductLine | ''>(product?.product_line ?? '')
  const [fieldErrors, setFieldErrors] = useState<{
    carrierId?: string
    name?: string
    productLine?: string
  }>({})

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
    const draft = validateProductDraft({
      carrierId,
      name,
      productLine,
      mode,
    })
    setFieldErrors(draft.fieldErrors)
    if (!canSubmitCatalogForm({ submitting, invalid: draft.invalid })) return
    onSubmit({
      carrierId,
      name: name.trim(),
      productLine: productLine as ProductionProductLine,
    })
  }

  const locked = mode === 'edit'
  const carrierName =
    carriers.find((carrier) => carrier.id === (product?.carrier_id ?? carrierId))?.name ?? 'Carrier'

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-catalog-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{mode === 'create' ? 'Add product' : 'Edit product'}</h2>
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
          <span>Carrier</span>
          {locked ? (
            <input value={carrierName} readOnly disabled aria-readonly="true" />
          ) : (
            <select
              ref={firstFieldRef as RefObject<HTMLSelectElement>}
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
              required
              disabled={submitting || createCarriers.length === 0}
              aria-invalid={Boolean(fieldErrors.carrierId)}
            >
              <option value="">Select a carrier</option>
              {createCarriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name} ({carrier.code})
                </option>
              ))}
            </select>
          )}
          {locked ? (
            <span className="crm-muted">Carrier cannot be changed after product creation.</span>
          ) : null}
          {fieldErrors.carrierId ? (
            <span className="crm-field-error">{fieldErrors.carrierId}</span>
          ) : null}
        </label>

        <label className="crm-field">
          <span>Product name</span>
          <input
            ref={locked ? (firstFieldRef as RefObject<HTMLInputElement>) : undefined}
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

        <label className="crm-field">
          <span>Product line</span>
          {locked ? (
            <input
              value={formatCatalogProductLineLabel(product?.product_line)}
              readOnly
              disabled
              aria-readonly="true"
            />
          ) : (
            <select
              value={productLine}
              onChange={(e) => setProductLine(e.target.value as ProductionProductLine | '')}
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.productLine)}
            >
              <option value="">Select a product line</option>
              {PRODUCTION_PRODUCT_LINES.map((line) => (
                <option key={line} value={line}>
                  {formatCatalogProductLineLabel(line)}
                </option>
              ))}
            </select>
          )}
          {locked ? (
            <span className="crm-muted">Product line cannot be changed after creation.</span>
          ) : null}
          {fieldErrors.productLine ? (
            <span className="crm-field-error">{fieldErrors.productLine}</span>
          ) : null}
        </label>

        <div className="crm-form-actions">
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="crm-primary-btn" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save product'}
          </button>
        </div>
      </form>
    </section>
  )
}
