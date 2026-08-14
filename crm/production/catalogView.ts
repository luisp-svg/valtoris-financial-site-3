import type { CatalogCarrier, CatalogProduct } from './types'

export type CatalogViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready' }

export function shouldShowCatalogManagement(role: string | null | undefined): boolean {
  return role === 'owner'
}

export function getCatalogViewState(options: {
  loading: boolean
  error: string | null
  carrierCount: number
}): CatalogViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.carrierCount === 0) return { kind: 'empty' }
  return { kind: 'ready' }
}

export function canSubmitCatalogForm(options: {
  submitting: boolean
  invalid: boolean
}): boolean {
  return !options.submitting && !options.invalid
}

export function isCarrierCodeImmutable(): true {
  return true
}

export function isProductCarrierImmutable(): true {
  return true
}

export function isProductLineImmutable(): true {
  return true
}

export function catalogStatusLabel(isActive: boolean): 'Active' | 'Inactive' {
  return isActive ? 'Active' : 'Inactive'
}

export function catalogInactiveRowClass(isActive: boolean): string {
  return isActive ? '' : 'is-inactive'
}

export function needsDeactivationConfirmation(nextIsActive: boolean): boolean {
  return nextIsActive === false
}

export type CatalogDeactivationKind = 'carrier' | 'product'

export function catalogDeactivationCopy(
  kind: CatalogDeactivationKind,
  name: string,
): { title: string; body: string[]; confirmLabel: string } {
  if (kind === 'carrier') {
    return {
      title: `Deactivate ${name}?`,
      body: [
        'Inactive carriers cannot be used for new production applications.',
        'Historical cases stay attached to this carrier. Nothing is deleted.',
      ],
      confirmLabel: 'Deactivate carrier',
    }
  }
  return {
    title: `Deactivate ${name}?`,
    body: [
      'Inactive products cannot be used for new production applications.',
      'Historical cases stay attached to this product. Nothing is deleted.',
    ],
    confirmLabel: 'Deactivate product',
  }
}

export type CatalogProductGroup = {
  carrier: CatalogCarrier | null
  carrierId: string
  products: CatalogProduct[]
}

export function groupCatalogProductsByCarrier(
  products: CatalogProduct[],
  carriers: CatalogCarrier[],
  carrierFilter: string | 'all',
): CatalogProductGroup[] {
  const carrierById = new Map(carriers.map((carrier) => [carrier.id, carrier]))
  const filtered =
    carrierFilter === 'all' ? products : products.filter((row) => row.carrier_id === carrierFilter)

  const grouped = new Map<string, CatalogProduct[]>()
  for (const product of filtered) {
    const list = grouped.get(product.carrier_id) ?? []
    list.push(product)
    grouped.set(product.carrier_id, list)
  }

  const carrierOrder = carriers.map((carrier) => carrier.id)
  const extraIds = [...grouped.keys()].filter((id) => !carrierById.has(id))
  const orderedIds = [
    ...carrierOrder.filter((id) => grouped.has(id)),
    ...extraIds.sort(),
  ]

  return orderedIds.map((carrierId) => ({
    carrierId,
    carrier: carrierById.get(carrierId) ?? null,
    products: (grouped.get(carrierId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

export function activeCarriersForNewProducts(carriers: CatalogCarrier[]): CatalogCarrier[] {
  return carriers.filter((carrier) => carrier.is_active)
}

export function sortCatalogCarriers(carriers: CatalogCarrier[]): CatalogCarrier[] {
  return carriers.slice().sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function validateCarrierDraft(input: { code: string; name: string; mode: 'create' | 'edit' }): {
  invalid: boolean
  fieldErrors: { code?: string; name?: string }
} {
  const fieldErrors: { code?: string; name?: string } = {}
  const name = input.name.trim()
  if (!name) fieldErrors.name = 'Enter a carrier name.'
  else if (name.length > 200) fieldErrors.name = 'Carrier name must be 200 characters or fewer.'

  if (input.mode === 'create') {
    const code = input.code.trim()
    if (!code) fieldErrors.code = 'Enter a carrier code.'
    else if (code.length > 40) fieldErrors.code = 'Carrier code must be 40 characters or fewer.'
  }

  return { invalid: Object.keys(fieldErrors).length > 0, fieldErrors }
}

export function validateProductDraft(input: {
  carrierId: string
  name: string
  productLine: string
  mode: 'create' | 'edit'
}): {
  invalid: boolean
  fieldErrors: { carrierId?: string; name?: string; productLine?: string }
} {
  const fieldErrors: { carrierId?: string; name?: string; productLine?: string } = {}
  const name = input.name.trim()
  if (!name) fieldErrors.name = 'Enter a product name.'
  else if (name.length > 200) fieldErrors.name = 'Product name must be 200 characters or fewer.'

  if (input.mode === 'create') {
    if (!input.carrierId.trim()) fieldErrors.carrierId = 'Select a carrier.'
    if (!input.productLine.trim()) fieldErrors.productLine = 'Select a product line.'
  }

  return { invalid: Object.keys(fieldErrors).length > 0, fieldErrors }
}
