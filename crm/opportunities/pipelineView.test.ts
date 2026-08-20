import { describe, expect, it } from 'vitest'
import { normalizeOpportunityListItem } from './opportunitiesApi'
import {
  applyPipelineView,
  countPipelineViews,
  filterPipelineOpportunities,
  formatOpportunityAttentionLabels,
  formatOpportunityNextActionDueLabel,
  getOpportunityPrimaryProductLabel,
  opportunityAttentionFlags,
  opportunityNeedsAttention,
  pipelineCardCopy,
  pipelineEmptyCopy,
  pipelineViewFromSearchParams,
  pipelineViewLabel,
  writePipelineViewSearchParams,
} from './pipelineView'
import type { OpportunityListItem } from './types'
import { crmOpportunityPath } from '../../constants/routes'

const TODAY = '2026-08-20'

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
    next_action_due_at: '2026-08-22',
    stage_entered_at: '2026-08-10T10:00:00.000Z',
    closed_at: null,
    updated_at: '2026-08-18T12:00:00.000Z',
    created_at: '2026-08-01T12:00:00.000Z',
    household: { id: 'hh-1', display_name: 'Rivera Family' },
    pipeline: { id: 'pipe-1', name: 'Life Insurance Pipeline' },
    stage: {
      id: 'stage-1',
      name: 'Fact Finder',
      code: 'fact_finder',
      sort_order: 2,
      is_won: false,
      is_lost: false,
      is_terminal: false,
    },
    service_vertical: { id: 'vert-1', code: 'life', name: 'Life Insurance' },
    assigned_advisor: { id: 'adv-1', display_name: 'Alex Advisor' },
    ...overrides,
  }
}

function item(overrides: Partial<OpportunityListItem> = {}): OpportunityListItem {
  return {
    ...normalizeOpportunityListItem(makeRawRow()),
    ...overrides,
  }
}

describe('pipeline view search params', () => {
  it('maps dashboard open/won/lost deep-links onto Phase 1 chips', () => {
    expect(pipelineViewFromSearchParams(new URLSearchParams('statusGroup=open'))).toBe('active')
    expect(pipelineViewFromSearchParams(new URLSearchParams('status=won'))).toBe('won')
    expect(pipelineViewFromSearchParams(new URLSearchParams('status=lost'))).toBe('lost')
    expect(pipelineViewFromSearchParams(new URLSearchParams())).toBe('active')
  })

  it('prefers view= over legacy status params', () => {
    expect(pipelineViewFromSearchParams(new URLSearchParams('view=mine&status=won'))).toBe('mine')
    expect(pipelineViewFromSearchParams(new URLSearchParams('view=attention'))).toBe('attention')
  })

  it('writes Active as statusGroup=open so dashboard links keep working', () => {
    const params = writePipelineViewSearchParams(new URLSearchParams('view=mine'), 'active')
    expect(params.get('statusGroup')).toBe('open')
    expect(params.get('view')).toBeNull()
    expect(params.get('status')).toBeNull()
  })

  it('labels the five operational views', () => {
    expect(pipelineViewLabel('active')).toBe('Active')
    expect(pipelineViewLabel('mine')).toBe('My Opportunities')
    expect(pipelineViewLabel('attention')).toBe('Needs Attention')
    expect(pipelineViewLabel('won')).toBe('Won')
    expect(pipelineViewLabel('lost')).toBe('Lost')
  })
})

describe('Active / My / Won / Lost filtering', () => {
  const rows = [
    item({ id: 'open-mine', status: 'open', assigned_advisor_id: 'adv-1' }),
    item({
      id: 'hold-other',
      status: 'on_hold',
      assigned_advisor_id: 'adv-2',
      updated_at: '2026-08-17T12:00:00.000Z',
    }),
    item({
      id: 'won-mine',
      status: 'won',
      assigned_advisor_id: 'adv-1',
      closed_at: '2026-08-19T12:00:00.000Z',
    }),
    item({
      id: 'lost-other',
      status: 'lost',
      assigned_advisor_id: 'adv-2',
      closed_at: '2026-08-15T12:00:00.000Z',
    }),
  ]

  it('Active is open and on_hold only', () => {
    const ids = filterPipelineOpportunities(rows, { view: 'active' }).map((row) => row.id)
    expect(ids).toEqual(['open-mine', 'hold-other'])
  })

  it('My Opportunities is assigned to the current advisor among active rows', () => {
    const mine = filterPipelineOpportunities(rows, {
      view: 'mine',
      assignedAdvisorId: 'adv-1',
    }).map((row) => row.id)
    expect(mine).toEqual(['open-mine'])
  })

  it('My Opportunities is empty without an advisor profile and does not change RLS', () => {
    expect(
      filterPipelineOpportunities(rows, { view: 'mine', assignedAdvisorId: null }),
    ).toEqual([])
  })

  it('Won and Lost use opportunity.status', () => {
    expect(filterPipelineOpportunities(rows, { view: 'won' }).map((row) => row.id)).toEqual([
      'won-mine',
    ])
    expect(filterPipelineOpportunities(rows, { view: 'lost' }).map((row) => row.id)).toEqual([
      'lost-other',
    ])
  })

  it('counts each chip from the same loaded set', () => {
    expect(countPipelineViews(rows, 'adv-1', TODAY)).toEqual({
      active: 2,
      mine: 1,
      attention: 0,
      won: 1,
      lost: 1,
    })
  })
})

describe('Needs Attention', () => {
  it('flags overdue next action on active opportunities only', () => {
    const overdue = item({
      id: 'overdue',
      next_action_due_at: '2026-08-01',
      stage_entered_at: '2026-08-18T00:00:00.000Z',
    })
    const flags = opportunityAttentionFlags(overdue, TODAY)
    expect(flags.overdueNextAction).toBe(true)
    expect(formatOpportunityAttentionLabels(flags)).toEqual(['Overdue next action'])
    expect(opportunityNeedsAttention(overdue, TODAY)).toBe(true)
    expect(
      opportunityAttentionFlags(item({ status: 'won', next_action_due_at: '2026-08-01' }), TODAY)
        .overdueNextAction,
    ).toBe(false)
  })

  it('reuses stale opportunity rules and prefers overdue over stale on the pill', () => {
    const stale = item({
      id: 'stale',
      next_action: null,
      next_action_due_at: null,
      stage_entered_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    })
    expect(opportunityAttentionFlags(stale, TODAY).stale).toBe(true)
    expect(formatOpportunityAttentionLabels(opportunityAttentionFlags(stale, TODAY))).toEqual([
      'Stale',
    ])

    const overdueAndOld = item({
      id: 'both',
      next_action_due_at: '2026-07-01',
      stage_entered_at: '2026-07-01T00:00:00.000Z',
    })
    expect(formatOpportunityAttentionLabels(opportunityAttentionFlags(overdueAndOld, TODAY))).toEqual(
      ['Overdue next action'],
    )
  })

  it('sorts Needs Attention overdue then due today then stale', () => {
    const sorted = applyPipelineView(
      [
        item({
          id: 'stale',
          next_action: null,
          next_action_due_at: null,
          stage_entered_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
        }),
        item({
          id: 'today',
          next_action_due_at: TODAY,
          stage_entered_at: '2026-08-18T00:00:00.000Z',
        }),
        item({
          id: 'overdue',
          next_action_due_at: '2026-08-01',
          stage_entered_at: '2026-08-18T00:00:00.000Z',
        }),
        item({
          id: 'healthy',
          next_action_due_at: '2026-08-28',
          stage_entered_at: '2026-08-18T00:00:00.000Z',
        }),
      ],
      { view: 'attention', today: TODAY },
    )
    expect(sorted.map((row) => row.id)).toEqual(['overdue', 'today', 'stale'])
  })
})

describe('card copy', () => {
  it('leads with household, service vertical, stage, advisor, and next action', () => {
    const copy = pipelineCardCopy(item(), TODAY)
    expect(copy.householdName).toBe('Rivera Family')
    expect(copy.primaryProduct).toBe('Life Insurance')
    expect(copy.stage).toBe('Fact Finder')
    expect(copy.advisor).toBe('Alex Advisor')
    expect(copy.nextAction).toBe('Call client')
    expect(copy.nextActionDue).toBe(formatOpportunityNextActionDueLabel('2026-08-22'))
    expect(getOpportunityPrimaryProductLabel(item())).toBe('Life Insurance')
  })

  it('does not invent a finer product taxonomy', () => {
    expect(getOpportunityPrimaryProductLabel(item())).not.toMatch(/Term|IUL|FIA|Auto|Home/)
    expect(crmOpportunityPath('opp-1')).toBe('/crm/opportunities/opp-1')
  })

  it('has operational empty copy per view', () => {
    expect(pipelineEmptyCopy('mine').title).toContain('assigned')
    expect(pipelineEmptyCopy('attention').title.toLowerCase()).toContain('attention')
  })
})
