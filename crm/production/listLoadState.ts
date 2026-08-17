export type ProductionListViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'filtered_empty' }
  | { kind: 'ready'; count: number }

/**
 * Distinguishes failed loads from legitimate empty lists.
 * Never returns `empty` when `error` is set.
 */
export function getProductionListViewState(options: {
  loading: boolean
  error: string | null
  totalCount: number
  filteredCount: number
}): ProductionListViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.totalCount === 0) return { kind: 'empty' }
  if (options.filteredCount === 0) return { kind: 'filtered_empty' }
  return { kind: 'ready', count: options.filteredCount }
}

export type ProductionDetailViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not_found' }
  | { kind: 'ready' }

export function getProductionDetailViewState(options: {
  loading: boolean
  error: string | null
  notFound: boolean
  hasApplication: boolean
}): ProductionDetailViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.notFound || !options.hasApplication) return { kind: 'not_found' }
  return { kind: 'ready' }
}

export type ProductionListPresentation = 'table' | 'cards'

/** Table-mode density only. Board vs Table is an explicit user toggle. */
export function getProductionListPresentation(viewportWidth: number): ProductionListPresentation {
  return viewportWidth < 900 ? 'cards' : 'table'
}

export type ProductionQueueViewMode = 'board' | 'table'

export const DEFAULT_PRODUCTION_QUEUE_VIEW: ProductionQueueViewMode = 'board'

export function isProductionQueueViewMode(value: string): value is ProductionQueueViewMode {
  return value === 'board' || value === 'table'
}

export function productionListCapWarning(
  loadedCount: number,
  limit: number,
): string | null {
  if (loadedCount !== limit) return null
  return `Showing the first ${limit} production records. Production dashboard and Advisor Compensation totals may be incomplete.`
}
