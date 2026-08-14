import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CatalogCarrierForm from '../../crm/production/CatalogCarrierForm'
import CatalogDeactivateDialog from '../../crm/production/CatalogDeactivateDialog'
import CatalogProductForm from '../../crm/production/CatalogProductForm'
import {
  createCarrier,
  createInsuranceProduct,
  fetchCatalogCarriers,
  fetchCatalogProducts,
  formatCatalogDevError,
  updateCarrier,
  updateInsuranceProduct,
} from '../../crm/production/catalogApi'
import { CATALOG_LOAD_ERROR } from '../../crm/production/catalogErrors'
import {
  activeCarriersForNewProducts,
  catalogDeactivationCopy,
  catalogInactiveRowClass,
  catalogStatusLabel,
  getCatalogViewState,
  groupCatalogProductsByCarrier,
  shouldShowCatalogManagement,
  sortCatalogCarriers,
} from '../../crm/production/catalogView'
import { formatCatalogProductLineLabel } from '../../crm/production/labels'
import type { CatalogCarrier, CatalogProduct, ProductionProductLine } from '../../crm/production/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type CarrierDialog =
  | { kind: 'create' }
  | { kind: 'edit'; carrier: CatalogCarrier }
  | null

type ProductDialog =
  | { kind: 'create' }
  | { kind: 'edit'; product: CatalogProduct }
  | null

type DeactivateDialog =
  | { kind: 'carrier'; carrier: CatalogCarrier }
  | { kind: 'product'; product: CatalogProduct }
  | null

export default function CrmProductionCatalogPage() {
  const { role } = useCrmAuth()
  const canManage = shouldShowCatalogManagement(role)

  const [carriers, setCarriers] = useState<CatalogCarrier[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [carrierFilter, setCarrierFilter] = useState<string | 'all'>('all')

  const [carrierDialog, setCarrierDialog] = useState<CarrierDialog>(null)
  const [productDialog, setProductDialog] = useState<ProductDialog>(null)
  const [deactivateDialog, setDeactivateDialog] = useState<DeactivateDialog>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [carrierRows, productRows] = await Promise.all([
          fetchCatalogCarriers(supabase),
          fetchCatalogProducts(supabase),
        ])
        if (!cancelled) {
          setCarriers(sortCatalogCarriers(carrierRows))
          setProducts(productRows)
        }
      } catch (err) {
        if (!cancelled) {
          setCarriers([])
          setProducts([])
          setError(CATALOG_LOAD_ERROR)
          if (import.meta.env.DEV) {
            console.error('[crm/production/catalog]', formatCatalogDevError('catalog-load', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const viewState = getCatalogViewState({
    loading,
    error,
    carrierCount: carriers.length,
  })
  const sortedCarriers = useMemo(() => sortCatalogCarriers(carriers), [carriers])
  const productGroups = useMemo(
    () => groupCatalogProductsByCarrier(products, sortedCarriers, carrierFilter),
    [products, sortedCarriers, carrierFilter],
  )
  const activeCarriers = useMemo(() => activeCarriersForNewProducts(sortedCarriers), [sortedCarriers])

  function closeDialogs() {
    if (submitting) return
    setCarrierDialog(null)
    setProductDialog(null)
    setDeactivateDialog(null)
    setFormError(null)
  }

  async function reloadCatalog() {
    setReloadKey((n) => n + 1)
  }

  async function handleCreateCarrier(input: { code: string; name: string }) {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await createCarrier(supabase, input)
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      setCarrierDialog(null)
      setSuccess(`Carrier “${result.record.name}” added.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditCarrier(input: { code: string; name: string }) {
    if (submitting || carrierDialog?.kind !== 'edit') return
    setSubmitting(true)
    setFormError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await updateCarrier(supabase, {
        id: carrierDialog.carrier.id,
        name: input.name,
      })
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      setCarrierDialog(null)
      setSuccess(`Carrier “${result.record.name}” updated.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateProduct(input: {
    carrierId: string
    name: string
    productLine: ProductionProductLine
  }) {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await createInsuranceProduct(supabase, input)
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      setProductDialog(null)
      setSuccess(`Product “${result.record.name}” added.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditProduct(input: { carrierId: string; name: string; productLine: ProductionProductLine }) {
    if (submitting || productDialog?.kind !== 'edit') return
    setSubmitting(true)
    setFormError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await updateInsuranceProduct(supabase, {
        id: productDialog.product.id,
        name: input.name,
      })
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      setProductDialog(null)
      setSuccess(`Product “${result.record.name}” updated.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (submitting || !deactivateDialog) return
    setSubmitting(true)
    setFormError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      if (deactivateDialog.kind === 'carrier') {
        const result = await updateCarrier(supabase, {
          id: deactivateDialog.carrier.id,
          isActive: false,
        })
        if (!result.ok) {
          setFormError(result.message)
          return
        }
        setDeactivateDialog(null)
        setSuccess(`Carrier “${result.record.name}” is now inactive. Historical cases stay attached.`)
      } else {
        const result = await updateInsuranceProduct(supabase, {
          id: deactivateDialog.product.id,
          isActive: false,
        })
        if (!result.ok) {
          setFormError(result.message)
          return
        }
        setDeactivateDialog(null)
        setSuccess(`Product “${result.record.name}” is now inactive. Historical cases stay attached.`)
      }
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReactivateCarrier(carrier: CatalogCarrier) {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    setSuccess(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await updateCarrier(supabase, { id: carrier.id, isActive: true })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSuccess(`Carrier “${result.record.name}” is active again.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReactivateProduct(product: CatalogProduct) {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    setSuccess(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await updateInsuranceProduct(supabase, { id: product.id, isActive: true })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSuccess(`Product “${result.record.name}” is active again.`)
      await reloadCatalog()
    } finally {
      setSubmitting(false)
    }
  }

  const deactivateCopy =
    deactivateDialog?.kind === 'carrier'
      ? catalogDeactivationCopy('carrier', deactivateDialog.carrier.name)
      : deactivateDialog?.kind === 'product'
        ? catalogDeactivationCopy('product', deactivateDialog.product.name)
        : null

  return (
    <div className="crm-page crm-opportunities-page crm-production-page crm-production-catalog-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Production</p>
          <h1 className="crm-page-title">Carriers & products</h1>
          <p className="crm-page-subtitle">
            {canManage
              ? 'Maintain the catalog required before Life, IUL, and FIA applications can be created. Inactive records stay attached to historical cases.'
              : 'Active carriers and products available for production. Catalog changes are owner-only.'}
          </p>
        </div>
        <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
          Back to Production
        </Link>
      </header>

      {success ? (
        <p className="crm-banner crm-banner-success" role="status">
          {success}
        </p>
      ) : null}

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}{' '}
          <button type="button" className="crm-text-btn" onClick={() => setReloadKey((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!canManage ? (
        <p className="crm-banner crm-banner-warning">
          Catalog management is available to owners. You can review active carriers and products.
        </p>
      ) : null}

      {carrierDialog?.kind === 'create' ? (
        <CatalogCarrierForm
          mode="create"
          submitting={submitting}
          error={formError}
          onCancel={closeDialogs}
          onSubmit={(input) => void handleCreateCarrier(input)}
        />
      ) : null}
      {carrierDialog?.kind === 'edit' ? (
        <CatalogCarrierForm
          mode="edit"
          carrier={carrierDialog.carrier}
          submitting={submitting}
          error={formError}
          onCancel={closeDialogs}
          onSubmit={(input) => void handleEditCarrier(input)}
        />
      ) : null}
      {productDialog?.kind === 'create' ? (
        <CatalogProductForm
          mode="create"
          carriers={sortedCarriers}
          submitting={submitting}
          error={formError}
          onCancel={closeDialogs}
          onSubmit={(input) => void handleCreateProduct(input)}
        />
      ) : null}
      {productDialog?.kind === 'edit' ? (
        <CatalogProductForm
          mode="edit"
          product={productDialog.product}
          carriers={sortedCarriers}
          submitting={submitting}
          error={formError}
          onCancel={closeDialogs}
          onSubmit={(input) => void handleEditProduct(input)}
        />
      ) : null}
      {deactivateDialog && deactivateCopy ? (
        <CatalogDeactivateDialog
          kind={deactivateDialog.kind}
          name={deactivateDialog.kind === 'carrier' ? deactivateDialog.carrier.name : deactivateDialog.product.name}
          title={deactivateCopy.title}
          body={deactivateCopy.body}
          confirmLabel={deactivateCopy.confirmLabel}
          submitting={submitting}
          error={formError}
          onCancel={closeDialogs}
          onConfirm={() => void handleConfirmDeactivate()}
        />
      ) : null}

      <section className="crm-panel" aria-label="Carriers">
        <div className="crm-panel-head">
          <h2>Carriers</h2>
          {canManage ? (
            <button
              type="button"
              className="crm-primary-btn"
              onClick={() => {
                setSuccess(null)
                setFormError(null)
                setCarrierDialog({ kind: 'create' })
              }}
              disabled={submitting || Boolean(carrierDialog || productDialog || deactivateDialog)}
            >
              Add carrier
            </button>
          ) : null}
        </div>

        {viewState.kind === 'loading' ? <p className="crm-muted">Loading catalog…</p> : null}
        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No carriers yet</p>
            <p>
              {canManage
                ? 'Add a carrier to start the production catalog. Products are added under a carrier.'
                : 'No active carriers are visible for your account.'}
            </p>
          </div>
        ) : null}
        {viewState.kind === 'ready' ? (
          <div className="crm-opportunities-table-wrap">
            <table className="crm-opportunities-table crm-catalog-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Code</th>
                  <th scope="col">Status</th>
                  {canManage ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedCarriers.map((carrier) => (
                  <tr key={carrier.id} className={catalogInactiveRowClass(carrier.is_active)}>
                    <td>
                      <p className="crm-opportunities-name">{carrier.name}</p>
                    </td>
                    <td>
                      <code className="crm-catalog-code">{carrier.code}</code>
                    </td>
                    <td>
                      <span className={`crm-catalog-status ${carrier.is_active ? 'is-active' : 'is-inactive'}`}>
                        {catalogStatusLabel(carrier.is_active)}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="crm-catalog-actions">
                        <button
                          type="button"
                          className="crm-text-btn"
                          disabled={submitting}
                          onClick={() => {
                            setSuccess(null)
                            setFormError(null)
                            setCarrierDialog({ kind: 'edit', carrier })
                          }}
                        >
                          Edit
                        </button>
                        {carrier.is_active ? (
                          <button
                            type="button"
                            className="crm-text-btn"
                            disabled={submitting}
                            onClick={() => {
                              setSuccess(null)
                              setFormError(null)
                              setDeactivateDialog({ kind: 'carrier', carrier })
                            }}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="crm-text-btn"
                            disabled={submitting}
                            onClick={() => void handleReactivateCarrier(carrier)}
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="crm-panel" aria-label="Products">
        <div className="crm-panel-head">
          <h2>Products</h2>
          {canManage ? (
            <button
              type="button"
              className="crm-primary-btn"
              onClick={() => {
                setSuccess(null)
                setFormError(null)
                setProductDialog({ kind: 'create' })
              }}
              disabled={
                submitting ||
                activeCarriers.length === 0 ||
                Boolean(carrierDialog || productDialog || deactivateDialog)
              }
            >
              Add product
            </button>
          ) : null}
        </div>

        {sortedCarriers.length > 0 ? (
          <label className="crm-field">
            <span>Filter by carrier</span>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value === 'all' ? 'all' : e.target.value)}
              disabled={loading}
            >
              <option value="all">All carriers</option>
              {sortedCarriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {canManage && activeCarriers.length === 0 && viewState.kind === 'ready' ? (
          <p className="crm-muted">Reactivate a carrier before adding a product.</p>
        ) : null}

        {viewState.kind === 'loading' ? <p className="crm-muted">Loading products…</p> : null}
        {viewState.kind === 'empty' || (viewState.kind === 'ready' && products.length === 0) ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No products yet</p>
            <p>
              {canManage
                ? 'Add a product under an active carrier. Product line is locked after creation.'
                : 'No active products are visible for your account.'}
            </p>
          </div>
        ) : null}

        {viewState.kind === 'ready' && products.length > 0 && productGroups.length === 0 ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No products for this carrier</p>
            <p>Choose another carrier or add a product.</p>
          </div>
        ) : null}

        {viewState.kind === 'ready' && productGroups.length > 0
          ? productGroups.map((group) => (
              <div key={group.carrierId} className="crm-catalog-product-group">
                <h3>{group.carrier?.name ?? 'Carrier'}</h3>
                <div className="crm-opportunities-table-wrap">
                  <table className="crm-opportunities-table crm-catalog-table">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Product line</th>
                        <th scope="col">Status</th>
                        {canManage ? <th scope="col">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {group.products.map((product) => (
                        <tr key={product.id} className={catalogInactiveRowClass(product.is_active)}>
                          <td>
                            <p className="crm-opportunities-name">{product.name}</p>
                          </td>
                          <td>{formatCatalogProductLineLabel(product.product_line)}</td>
                          <td>
                            <span
                              className={`crm-catalog-status ${product.is_active ? 'is-active' : 'is-inactive'}`}
                            >
                              {catalogStatusLabel(product.is_active)}
                            </span>
                          </td>
                          {canManage ? (
                            <td className="crm-catalog-actions">
                              <button
                                type="button"
                                className="crm-text-btn"
                                disabled={submitting}
                                onClick={() => {
                                  setSuccess(null)
                                  setFormError(null)
                                  setProductDialog({ kind: 'edit', product })
                                }}
                              >
                                Edit
                              </button>
                              {product.is_active ? (
                                <button
                                  type="button"
                                  className="crm-text-btn"
                                  disabled={submitting}
                                  onClick={() => {
                                    setSuccess(null)
                                    setFormError(null)
                                    setDeactivateDialog({ kind: 'product', product })
                                  }}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="crm-text-btn"
                                  disabled={submitting}
                                  onClick={() => void handleReactivateProduct(product)}
                                >
                                  Reactivate
                                </button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          : null}
      </section>
    </div>
  )
}
