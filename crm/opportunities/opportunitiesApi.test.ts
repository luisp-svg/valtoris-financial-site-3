import { describe, expect, it } from 'vitest'
import {
  asSingle,
  filterOpportunityListItems,
  formatOpportunityStatusLabel,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
  isClosedStatus,
  matchesStatusGroup,
  normalizeOpportunityActivityRow,
  normalizeOpportunityDetail,
  normalizeOpportunityListItem,
  opportunityMatchesSearch,
  parseOpportunityStatus,
  sortOpportunitiesByUpdatedAtDesc,
} from './opportunitiesApi'
import type { OpportunityListItem } from './types'

function makeRawRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'opp-1',
    title: 'Term Life Review',
    status: 'open',
    household_id: 'hh-1',
    pipeline_id: 'pipe-1',
    stage_id: 'stage-1',
    service_vertical_id: 'vert-1',
    assigned_advisor_id: 'adv-1',
    next_action: 'Call client',
    next_action_due_at: '2026-08-01',
    stage_entered_at: '2026-07-01T10:00:00.000Z',
    closed_at: null,
    updated_at: '2026-07-10T12:00:00.000Z',
    created_at: '2026-06-01T12:00:00.000Z',
    household: { id: 'hh-1', display_name: 'Rivera Family' },
    pipeline: { id: 'pipe-1', name: 'Life Insurance Pipeline' },
    stage: {
      id: 'stage-1',
      name: 'Underwriting',
      code: 'underwriting',
      sort_order: 6,
      is_won: false,
      is_lost: false,
      is_terminal: false,
    },
    service_vertical: { id: 'vert-1', code: 'life', name: 'Life Insurance' },
    assigned_advisor: { id: 'adv-1', display_name: 'Alex Advisor' },
    ...overrides,
  }
}

function makeListItem(overrides: Partial<OpportunityListItem> = {}): OpportunityListItem {
  return {
    ...normalizeOpportunityListItem(makeRawRow()),
    ...overrides,
  }
}

describe('opportunity response normalization', () => {
  it('normalizes embedded relationships into stable application types', () => {
    const item = normalizeOpportunityListItem(makeRawRow())
    expect(item.title).toBe('Term Life Review')
    expect(item.household).toEqual({ id: 'hh-1', display_name: 'Rivera Family' })
    expect(item.pipeline?.name).toBe('Life Insurance Pipeline')
    expect(item.stage?.code).toBe('underwriting')
    expect(item.service_vertical?.code).toBe('life')
    expect(item.assigned_advisor?.display_name).toBe('Alex Advisor')
  })

  it('accepts array-shaped PostgREST embeds via asSingle', () => {
    expect(asSingle([{ id: 'a' }])).toEqual({ id: 'a' })
    expect(asSingle([])).toBeNull()
    const item = normalizeOpportunityListItem(
      makeRawRow({
        household: [{ id: 'hh-2', display_name: 'Array Household' }],
        stage: [],
        pipeline: null,
        assigned_advisor: null,
      }),
    )
    expect(item.household?.display_name).toBe('Array Household')
    expect(item.stage).toBeNull()
    expect(item.pipeline).toBeNull()
    expect(item.assigned_advisor).toBeNull()
  })

  it('handles missing optional relationships without inventing stage names', () => {
    const item = normalizeOpportunityListItem(
      makeRawRow({
        stage: null,
        pipeline: undefined,
        service_vertical: null,
        assigned_advisor: null,
        household: null,
        next_action: null,
      }),
    )
    expect(item.stage).toBeNull()
    expect(getOpportunityStageLabel(item)).toBe('Stage unavailable')
    expect(getOpportunityPipelineLabel(item)).toBe('Pipeline unavailable')
    expect(getOpportunityVerticalLabel(item)).toBe('Service unavailable')
    expect(getOpportunityOwnerLabel(item)).toBe('Unassigned')
    expect(getOpportunityHouseholdLabel(item)).toBe('Household unavailable')
  })

  it('does not substitute hard-coded lifecycle stage labels for missing stages', () => {
    const item = normalizeOpportunityListItem(makeRawRow({ stage: null }))
    const label = getOpportunityStageLabel(item)
    expect(label).not.toMatch(/Lead|Consultation|Underwriting|In Force/i)
    expect(label).toBe('Stage unavailable')
  })

  it('preserves database stage name/code exactly when present', () => {
    const item = normalizeOpportunityListItem(
      makeRawRow({
        stage: {
          id: 'stage-x',
          name: 'Fact Finder',
          code: 'fact_finder',
          sort_order: 2,
          is_won: false,
          is_lost: false,
          is_terminal: false,
        },
      }),
    )
    expect(item.stage?.name).toBe('Fact Finder')
    expect(item.stage?.code).toBe('fact_finder')
    expect(getOpportunityStageLabel(item)).toBe('Fact Finder')
  })

  it('normalizes detail fields including metadata', () => {
    const detail = normalizeOpportunityDetail(
      makeRawRow({
        need_identified: true,
        source_assessment_id: 'assess-1',
        source_lead_id: null,
        source_recommendation_id: 'rec-1',
        assigned_at: '2026-07-02T00:00:00.000Z',
        assignment_reason: 'manual',
        metadata: { converted_from_recommendation_id: 'rec-1' },
      }),
    )
    expect(detail.need_identified).toBe(true)
    expect(detail.source_recommendation_id).toBe('rec-1')
    expect(detail.metadata).toEqual({ converted_from_recommendation_id: 'rec-1' })
  })

  it('parses known statuses and falls back safely for unknown values', () => {
    expect(parseOpportunityStatus('won')).toBe('won')
    expect(parseOpportunityStatus('nope')).toBe('open')
    expect(formatOpportunityStatusLabel('on_hold')).toBe('On hold')
  })
})

describe('list ordering and filtering', () => {
  it('orders by updated_at descending then id', () => {
    const sorted = sortOpportunitiesByUpdatedAtDesc([
      makeListItem({
        id: 'b',
        updated_at: '2026-07-01T00:00:00.000Z',
      }),
      makeListItem({
        id: 'a',
        updated_at: '2026-07-03T00:00:00.000Z',
      }),
      makeListItem({
        id: 'c',
        updated_at: '2026-07-03T00:00:00.000Z',
      }),
    ])
    expect(sorted.map((row) => row.id)).toEqual(['c', 'a', 'b'])
  })

  it('matches search across title and relationship labels', () => {
    const item = makeListItem()
    expect(opportunityMatchesSearch(item, 'term')).toBe(true)
    expect(opportunityMatchesSearch(item, 'rivera')).toBe(true)
    expect(opportunityMatchesSearch(item, 'underwriting')).toBe(true)
    expect(opportunityMatchesSearch(item, 'alex')).toBe(true)
    expect(opportunityMatchesSearch(item, 'zzz')).toBe(false)
  })

  it('filters by status group without inventing stages', () => {
    expect(isClosedStatus('won')).toBe(true)
    expect(matchesStatusGroup('open', 'open')).toBe(true)
    expect(matchesStatusGroup('on_hold', 'open')).toBe(true)
    expect(matchesStatusGroup('lost', 'closed')).toBe(true)
    expect(matchesStatusGroup('open', 'closed')).toBe(false)

    const filtered = filterOpportunityListItems(
      [
        makeListItem({ id: '1', title: 'A', status: 'open' }),
        makeListItem({ id: '2', title: 'B Life', status: 'won' }),
      ],
      { search: 'life', statusGroup: 'closed' },
    )
    expect(filtered.map((row) => row.id)).toEqual(['2'])
  })
})

describe('activity normalization', () => {
  it('normalizes activity rows and missing actor names', () => {
    const row = normalizeOpportunityActivityRow({
      id: 'act-1',
      household_id: 'hh-1',
      opportunity_id: 'opp-1',
      actor_user_id: 'user-1',
      activity_type: 'stage_changed',
      title: 'Opportunity stage updated',
      body: 'Underwriting',
      metadata: { from_stage_id: 'a', to_stage_id: 'b' },
      occurred_at: '2026-07-10T12:00:00.000Z',
      created_at: '2026-07-10T12:00:00.000Z',
      actor: null,
    })
    expect(row.opportunity_id).toBe('opp-1')
    expect(row.actor_display_name).toBe('Advisor')
    expect(row.metadata).toEqual({ from_stage_id: 'a', to_stage_id: 'b' })
  })
})
