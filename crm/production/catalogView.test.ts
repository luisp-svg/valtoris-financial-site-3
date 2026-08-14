import { describe, expect, it } from 'vitest'
import {
  activeCarriersForNewProducts,
  canSubmitCatalogForm,
  catalogDeactivationCopy,
  catalogInactiveRowClass,
  catalogStatusLabel,
  getCatalogViewState,
  groupCatalogProductsByCarrier,
  isCarrierCodeImmutable,
  isProductCarrierImmutable,
  isProductLineImmutable,
  needsDeactivationConfirmation,
  shouldShowCatalogManagement,
  sortCatalogCarriers,
  validateCarrierDraft,
  validateProductDraft,
} from './catalogView'
import type { CatalogCarrier, CatalogProduct } from './types'

function carrier(partial: Partial<CatalogCarrier> & Pick<CatalogCarrier, 'id' | 'name'>): CatalogCarrier {
  return {
    code: partial.code ?? partial.id,
    is_active: partial.is_active ?? true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...partial,
  }
}

function product(
  partial: Partial<CatalogProduct> & Pick<CatalogProduct, 'id' | 'carrier_id' | 'name'>,
): CatalogProduct {
  return {
    product_line: 'life_term',
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...partial,
  }
}

describe('catalog view helpers', () => {
  it('shows owner management and hides advisor actions', () => {
    expect(shouldShowCatalogManagement('owner')).toBe(true)
    expect(shouldShowCatalogManagement('advisor')).toBe(false)
    expect(shouldShowCatalogManagement(null)).toBe(false)
  })

  it('maps loading, error, empty, and ready catalog states', () => {
    expect(getCatalogViewState({ loading: true, error: null, carrierCount: 0 })).toEqual({
      kind: 'loading',
    })
    expect(getCatalogViewState({ loading: false, error: 'fail', carrierCount: 0 })).toEqual({
      kind: 'error',
      message: 'fail',
    })
    expect(getCatalogViewState({ loading: false, error: null, carrierCount: 0 }).kind).toBe('empty')
    expect(getCatalogViewState({ loading: false, error: null, carrierCount: 2 }).kind).toBe('ready')
  })

  it('blocks submit while pending or invalid', () => {
    expect(canSubmitCatalogForm({ submitting: true, invalid: false })).toBe(false)
    expect(canSubmitCatalogForm({ submitting: false, invalid: true })).toBe(false)
    expect(canSubmitCatalogForm({ submitting: false, invalid: false })).toBe(true)
  })

  it('treats carrier code, product carrier, and product line as immutable', () => {
    expect(isCarrierCodeImmutable()).toBe(true)
    expect(isProductCarrierImmutable()).toBe(true)
    expect(isProductLineImmutable()).toBe(true)
    expect(validateCarrierDraft({ code: 'X', name: 'Name', mode: 'edit' }).fieldErrors.code).toBeUndefined()
  })

  it('requires confirmation only for deactivation', () => {
    expect(needsDeactivationConfirmation(false)).toBe(true)
    expect(needsDeactivationConfirmation(true)).toBe(false)
    const copy = catalogDeactivationCopy('carrier', 'Acme')
    expect(copy.title).toMatch(/Deactivate Acme/)
    expect(copy.body.join(' ')).toMatch(/Historical cases stay attached/)
  })

  it('styles inactive rows and labels', () => {
    expect(catalogStatusLabel(false)).toBe('Inactive')
    expect(catalogInactiveRowClass(false)).toBe('is-inactive')
    expect(catalogInactiveRowClass(true)).toBe('')
  })

  it('groups and filters products by carrier', () => {
    const carriers = [
      carrier({ id: 'c2', name: 'Beta', is_active: true }),
      carrier({ id: 'c1', name: 'Alpha', is_active: false }),
    ]
    const products = [
      product({ id: 'p1', carrier_id: 'c1', name: 'Term' }),
      product({ id: 'p2', carrier_id: 'c2', name: 'IUL' }),
    ]
    const all = groupCatalogProductsByCarrier(products, carriers, 'all')
    expect(all.map((g) => g.carrierId)).toEqual(['c2', 'c1'])
    const filtered = groupCatalogProductsByCarrier(products, carriers, 'c2')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].products[0].name).toBe('IUL')
  })

  it('sorts active carriers first and limits new products to active carriers', () => {
    const sorted = sortCatalogCarriers([
      carrier({ id: 'c1', name: 'Zed', is_active: false }),
      carrier({ id: 'c2', name: 'Ace', is_active: true }),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['c2', 'c1'])
    expect(activeCarriersForNewProducts(sorted).map((c) => c.id)).toEqual(['c2'])
  })

  it('validates carrier and product drafts', () => {
    expect(validateCarrierDraft({ code: '', name: '', mode: 'create' }).invalid).toBe(true)
    expect(validateProductDraft({ carrierId: '', name: '', productLine: '', mode: 'create' }).invalid).toBe(
      true,
    )
    expect(
      validateProductDraft({
        carrierId: 'c1',
        name: 'Term 20',
        productLine: 'life_term',
        mode: 'create',
      }).invalid,
    ).toBe(false)
  })
})
