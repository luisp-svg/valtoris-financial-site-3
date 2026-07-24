import type { OpportunityLoadResult } from './types'

export type OpportunityListViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'filtered_empty' }
  | { kind: 'ready'; count: number }

/**
 * Distinguishes failed loads from legitimate empty lists.
 * Never returns `empty` when `error` is set.
 */
export function getOpportunityListViewState(options: {
  loading: boolean
  error: string | null
  totalCount: number
  filteredCount: number
}): OpportunityListViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.totalCount === 0) return { kind: 'empty' }
  if (options.filteredCount === 0) return { kind: 'filtered_empty' }
  return { kind: 'ready', count: options.filteredCount }
}

export type OpportunityActivityViewState =
  | { kind: 'load_error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; count: number }

export function getOpportunityActivityViewState(
  activities: OpportunityLoadResult<unknown[]>,
): OpportunityActivityViewState {
  if (!activities.ok) {
    return {
      kind: 'load_error',
      message: 'Unable to load opportunity activity.',
    }
  }
  if (activities.value.length === 0) {
    return { kind: 'empty' }
  }
  return { kind: 'ready', count: activities.value.length }
}

export type OpportunityWorkspaceViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not_found' }
  | { kind: 'ready' }

export function getOpportunityWorkspaceViewState(options: {
  loading: boolean
  error: string | null
  notFound: boolean
  hasOpportunity: boolean
}): OpportunityWorkspaceViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.notFound || !options.hasOpportunity) return { kind: 'not_found' }
  return { kind: 'ready' }
}

/** Desktop table vs mobile stacked cards — matches households breakpoint usage. */
export type OpportunityListPresentation = 'table' | 'cards'

export function getOpportunityListPresentation(viewportWidth: number): OpportunityListPresentation {
  return viewportWidth < 900 ? 'cards' : 'table'
}
