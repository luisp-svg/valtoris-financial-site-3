import { describe, expect, it } from 'vitest'
import { crmHouseholdPath, crmOpportunityPath, ROUTES } from '../../constants/routes'
import { getOpportunityListViewState } from './listLoadState'

describe('CRM-8.2A navigation helpers', () => {
  it('builds opportunity workspace path after create success', () => {
    expect(crmOpportunityPath('opp-123')).toBe('/crm/opportunities/opp-123')
    expect(ROUTES.crmPipeline).toBe('/crm/pipeline')
  })

  it('builds household path used for household-prefilled create entry', () => {
    expect(crmHouseholdPath('hh-1')).toBe('/crm/households/hh-1')
  })
})

describe('CRM-8.2A reference-load vs empty messaging', () => {
  it('keeps error distinct from empty list', () => {
    expect(
      getOpportunityListViewState({
        loading: false,
        error: 'Unable to load opportunities. Please try again.',
        totalCount: 0,
        filteredCount: 0,
      }).kind,
    ).toBe('error')

    expect(
      getOpportunityListViewState({
        loading: false,
        error: null,
        totalCount: 0,
        filteredCount: 0,
      }).kind,
    ).toBe('empty')
  })
})
