import { describe, expect, it } from 'vitest'
import {
  getOpportunityActivityViewState,
  getOpportunityListPresentation,
  getOpportunityListViewState,
  getOpportunityWorkspaceViewState,
} from './listLoadState'
import { crmHouseholdPath, crmOpportunityPath, ROUTES } from '../../constants/routes'

describe('opportunity list load state', () => {
  it('returns loading before any empty/error decision', () => {
    expect(
      getOpportunityListViewState({
        loading: true,
        error: null,
        totalCount: 0,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'loading' })
  })

  it('does not treat failed loads as empty states', () => {
    const state = getOpportunityListViewState({
      loading: false,
      error: 'Unable to load opportunities. Please try again.',
      totalCount: 0,
      filteredCount: 0,
    })
    expect(state.kind).toBe('error')
    if (state.kind !== 'error') throw new Error('expected error')
    expect(state.message).toContain('Unable to load')
    expect(state.kind).not.toBe('empty')
  })

  it('distinguishes true empty from filtered empty', () => {
    expect(
      getOpportunityListViewState({
        loading: false,
        error: null,
        totalCount: 0,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'empty' })

    expect(
      getOpportunityListViewState({
        loading: false,
        error: null,
        totalCount: 3,
        filteredCount: 0,
      }),
    ).toEqual({ kind: 'filtered_empty' })
  })

  it('returns ready with filtered count', () => {
    expect(
      getOpportunityListViewState({
        loading: false,
        error: null,
        totalCount: 5,
        filteredCount: 2,
      }),
    ).toEqual({ kind: 'ready', count: 2 })
  })
})

describe('opportunity workspace and activity load state', () => {
  it('prioritizes error over not-found', () => {
    expect(
      getOpportunityWorkspaceViewState({
        loading: false,
        error: 'boom',
        notFound: true,
        hasOpportunity: false,
      }),
    ).toEqual({ kind: 'error', message: 'boom' })
  })

  it('returns not_found when load succeeded without a row', () => {
    expect(
      getOpportunityWorkspaceViewState({
        loading: false,
        error: null,
        notFound: true,
        hasOpportunity: false,
      }),
    ).toEqual({ kind: 'not_found' })
  })

  it('does not treat failed activity loads as empty', () => {
    const state = getOpportunityActivityViewState({
      ok: false,
      value: [],
      error: 'opportunity_activities failed | message=boom',
    })
    expect(state.kind).toBe('load_error')
    expect(state).not.toEqual({ kind: 'empty' })
  })

  it('returns empty only for successful empty activity arrays', () => {
    expect(getOpportunityActivityViewState({ ok: true, value: [] })).toEqual({ kind: 'empty' })
    expect(getOpportunityActivityViewState({ ok: true, value: [{ id: '1' }] })).toEqual({
      kind: 'ready',
      count: 1,
    })
  })
})

describe('opportunity route helpers and presentation', () => {
  it('builds opportunity and household paths for bidirectional navigation', () => {
    expect(ROUTES.crmPipeline).toBe('/crm/pipeline')
    expect(ROUTES.crmOpportunities).toBe('/crm/opportunities')
    expect(crmOpportunityPath('opp-123')).toBe('/crm/opportunities/opp-123')
    expect(crmHouseholdPath('hh-123')).toBe('/crm/households/hh-123')
  })

  it('uses cards on mobile-width viewports and table on desktop', () => {
    expect(getOpportunityListPresentation(375)).toBe('cards')
    expect(getOpportunityListPresentation(899)).toBe('cards')
    expect(getOpportunityListPresentation(900)).toBe('table')
    expect(getOpportunityListPresentation(1280)).toBe('table')
  })
})
