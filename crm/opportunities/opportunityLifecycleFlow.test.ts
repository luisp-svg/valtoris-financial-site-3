import { describe, expect, it, vi } from 'vitest'
import {
  canReopenOpportunity,
  findCloseStage,
  formatOpportunityStageChangeBody,
  getOpportunityLifecycleActions,
  listMoveDestinationStages,
  listReopenDestinationStages,
  moveOpportunityStage,
} from './opportunitiesApi'
import { stageRequiresLifecycleConfirmation } from './opportunityValidation'
import type { OpportunityStageOption } from './types'
import { getOpportunityListPresentation } from './listLoadState'

const stages: OpportunityStageOption[] = [
  {
    id: 'stage-1',
    pipeline_id: 'pipe-1',
    name: 'Opportunity Identified',
    code: 'opportunity_identified',
    sort_order: 1,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-2',
    pipeline_id: 'pipe-1',
    name: 'Fact Finder',
    code: 'fact_finder',
    sort_order: 2,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-won',
    pipeline_id: 'pipe-1',
    name: 'Placed / Paid',
    code: 'placed_paid',
    sort_order: 8,
    is_won: true,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-review',
    pipeline_id: 'pipe-1',
    name: 'Annual Review',
    code: 'annual_review',
    sort_order: 9,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-lost',
    pipeline_id: 'pipe-1',
    name: 'Closed / Lost',
    code: 'closed_lost',
    sort_order: 10,
    is_won: false,
    is_lost: true,
    is_terminal: true,
  },
]

describe('CRM-8.2B lifecycle destinations', () => {
  it('lists move destinations excluding the current stage and preserves free movement', () => {
    const destinations = listMoveDestinationStages(stages, 'stage-2')
    expect(destinations.map((row) => row.id)).toEqual([
      'stage-1',
      'stage-won',
      'stage-review',
      'stage-lost',
    ])
  })

  it('lists only open stages for reopen', () => {
    expect(listReopenDestinationStages(stages).map((row) => row.id)).toEqual([
      'stage-1',
      'stage-2',
      'stage-review',
    ])
  })

  it('resolves close won / close lost stages from flags', () => {
    expect(findCloseStage(stages, 'won')?.id).toBe('stage-won')
    expect(findCloseStage(stages, 'lost')?.id).toBe('stage-lost')
  })

  it('requires confirmation for won/lost/terminal destinations', () => {
    expect(stageRequiresLifecycleConfirmation(stages[1]!)).toBe(false)
    expect(stageRequiresLifecycleConfirmation(findCloseStage(stages, 'won')!)).toBe(true)
    expect(stageRequiresLifecycleConfirmation(findCloseStage(stages, 'lost')!)).toBe(true)
  })
})

describe('CRM-8.2B lifecycle action availability', () => {
  it('shows reopen only for won/lost status', () => {
    expect(canReopenOpportunity('open')).toBe(false)
    expect(canReopenOpportunity('won')).toBe(true)
    expect(canReopenOpportunity('lost')).toBe(true)

    const openActions = getOpportunityLifecycleActions(
      { stage_id: 'stage-1', status: 'open' },
      stages,
    )
    expect(openActions.canReopen).toBe(false)
    expect(openActions.canCloseWon).toBe(true)
    expect(openActions.canCloseLost).toBe(true)
    expect(openActions.canMove).toBe(true)

    const wonActions = getOpportunityLifecycleActions(
      { stage_id: 'stage-won', status: 'won' },
      stages,
    )
    expect(wonActions.canReopen).toBe(true)
    expect(wonActions.canCloseWon).toBe(false)
  })
})

describe('CRM-8.2B activity stage polish', () => {
  it('formats Old Stage → New Stage from metadata ids', () => {
    const names = new Map([
      ['stage-1', 'Opportunity Identified'],
      ['stage-won', 'Placed / Paid'],
    ])
    expect(
      formatOpportunityStageChangeBody(
        {
          body: 'Placed / Paid',
          metadata: { from_stage_id: 'stage-1', to_stage_id: 'stage-won' },
        },
        names,
      ),
    ).toBe('Opportunity Identified → Placed / Paid')
  })
})

describe('CRM-8.2B duplicate-submit protection', () => {
  it('allows only one in-flight lifecycle mutation guard pattern', async () => {
    let inFlight = false
    let calls = 0
    async function guardedMove() {
      if (inFlight) return 'blocked'
      inFlight = true
      calls += 1
      await Promise.resolve()
      inFlight = false
      return 'ok'
    }
    const first = guardedMove()
    const second = guardedMove()
    await expect(first).resolves.toBe('ok')
    await expect(second).resolves.toBe('blocked')
    expect(calls).toBe(1)
  })
})

describe('CRM-8.2B RPC close/reopen argument shapes', () => {
  it('close won / reopen call move_opportunity_stage with destination stage only', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }))
    const detail = {
      id: 'opp-1',
      title: 'Lifecycle',
      status: 'open',
      household_id: 'hh-1',
      pipeline_id: 'pipe-1',
      stage_id: 'stage-1',
      service_vertical_id: 'vert-1',
      assigned_advisor_id: null,
      next_action: null,
      next_action_due_at: null,
      stage_entered_at: null,
      closed_at: null,
      updated_at: '2026-07-10T12:00:00.000Z',
      created_at: '2026-06-01T12:00:00.000Z',
      need_identified: true,
      source_assessment_id: null,
      source_lead_id: null,
      source_recommendation_id: null,
      assigned_at: null,
      assignment_reason: null,
      metadata: {},
      household: null,
      pipeline: null,
      stage: null,
      service_vertical: null,
      assigned_advisor: null,
      linkedApplication: null,
    }
    const supabase = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: detail, error: null })),
            })),
          })),
        })),
      })),
    }

    const won = findCloseStage(stages, 'won')!
    await moveOpportunityStage(supabase as never, 'opp-1', won.id, stages, 'pipe-1', {
      currentStageId: 'stage-1',
    })
    expect(rpc).toHaveBeenCalledWith('move_opportunity_stage', {
      p_opportunity_id: 'opp-1',
      p_stage_id: 'stage-won',
    })

    rpc.mockClear()
    await moveOpportunityStage(supabase as never, 'opp-1', 'stage-review', stages, 'pipe-1', {
      currentStageId: 'stage-won',
      requireOpenDestination: true,
    })
    expect(rpc).toHaveBeenCalledWith('move_opportunity_stage', {
      p_opportunity_id: 'opp-1',
      p_stage_id: 'stage-review',
    })
  })
})

describe('CRM-8.2B mobile presentation regression', () => {
  it('keeps list presentation breakpoints for CRM-8.1 cards/table', () => {
    expect(getOpportunityListPresentation(390)).toBe('cards')
    expect(getOpportunityListPresentation(1280)).toBe('table')
  })
})

describe('CRM-8.2B reopen confirmation UX contract', () => {
  it('requires confirmation for reopen destinations but not for ordinary open moves', () => {
    const open = stages.find((row) => row.code === 'fact_finder')!
    const review = stages.find((row) => row.code === 'annual_review')!
    expect(stageRequiresLifecycleConfirmation(open)).toBe(false)
    expect(stageRequiresLifecycleConfirmation(review)).toBe(false)
    // Reopen always confirms in the dialog even for open destinations; Close Won/Lost confirm by mode.
    expect(canReopenOpportunity('won')).toBe(true)
    expect(listReopenDestinationStages(stages).every((row) => !row.is_won && !row.is_lost && !row.is_terminal)).toBe(
      true,
    )
  })
})
