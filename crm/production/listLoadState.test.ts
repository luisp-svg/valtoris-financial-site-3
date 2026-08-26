import { describe, expect, it } from 'vitest'
import {
  CASE_VIEWS_LOADED_RECORDS_NOTE,
  DEFAULT_PRODUCTION_QUEUE_VIEW,
  getProductionDetailViewState,
  getProductionListPresentation,
  getProductionListViewState,
  isProductionQueueViewMode,
  productionListCapWarning,
  caseViewsCapReached,
} from './listLoadState'

describe('production list/detail view states', () => {
  it('returns loading, error, empty, filtered_empty, and ready', () => {
    expect(
      getProductionListViewState({
        loading: true,
        error: null,
        totalCount: 0,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'loading' })

    expect(
      getProductionListViewState({
        loading: false,
        error: 'boom',
        totalCount: 0,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'error', message: 'boom' })

    expect(
      getProductionListViewState({
        loading: false,
        error: null,
        totalCount: 0,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'empty' })

    expect(
      getProductionListViewState({
        loading: false,
        error: null,
        totalCount: 3,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'filtered_empty' })

    expect(
      getProductionListViewState({
        loading: false,
        error: null,
        totalCount: 3,
        filteredCount: 2,
      }),
    ).toEqual({ kind: 'ready', count: 2 })
  })

  it('never treats an errored load as empty', () => {
    expect(
      getProductionListViewState({
        loading: false,
        error: 'fail',
        totalCount: 0,
        filteredCount: 0,
      }).kind,
    ).toBe('error')
  })

  it('maps detail not-found and ready states', () => {
    expect(
      getProductionDetailViewState({
        loading: false,
        error: null,
        notFound: true,
        hasApplication: false,
      }),
    ).toEqual({ kind: 'not_found' })
    expect(
      getProductionDetailViewState({
        loading: false,
        error: null,
        notFound: false,
        hasApplication: true,
      }),
    ).toEqual({ kind: 'ready' })
  })

  it('uses cards below 900px for table-mode density only', () => {
    expect(getProductionListPresentation(899)).toBe('cards')
    expect(getProductionListPresentation(900)).toBe('table')
    expect(DEFAULT_PRODUCTION_QUEUE_VIEW).toBe('board')
    expect(isProductionQueueViewMode('board')).toBe(true)
    expect(isProductionQueueViewMode('table')).toBe(true)
    expect(isProductionQueueViewMode('cards')).toBe(false)
  })

  it('warns when the loaded list hits the 200-row cap', () => {
    expect(productionListCapWarning(199, 200)).toBeNull()
    expect(productionListCapWarning(200, 200)).toBe(
      'Showing the first 200 production records. Production dashboard, Case views, and Advisor Compensation totals may be incomplete.',
    )
    expect(productionListCapWarning(0, 200)).toBeNull()
  })

  it('exposes an always-accurate Case-view loaded-records note without fabricating truncation', () => {
    expect(CASE_VIEWS_LOADED_RECORDS_NOTE).toBe(
      'Case views reflect the currently loaded production records.',
    )
    expect(caseViewsCapReached(199, 200)).toBe(false)
    expect(caseViewsCapReached(200, 200)).toBe(true)
    expect(caseViewsCapReached(0, 200)).toBe(false)
  })
})
