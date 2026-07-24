import { describe, expect, it, vi } from 'vitest'
import {
  asSingle,
  createOpportunity,
  filterOpportunityListItems,
  findCloseStage,
  formatOpportunityStatusLabel,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
  isClosedStatus,
  matchesStatusGroup,
  moveOpportunityStage,
  normalizeOpportunityActivityRow,
  normalizeOpportunityDetail,
  normalizeOpportunityListItem,
  OPPORTUNITY_ARCHIVE_SUPPORT,
  opportunityMatchesSearch,
  parseOpportunityStatus,
  pickDefaultPipeline,
  pickDefaultStage,
  OPPORTUNITY_INSERT_ALLOWLIST,
  OPPORTUNITY_UPDATE_ALLOWLIST,
  OPPORTUNITY_UPDATE_FORBIDDEN,
  softDeleteOpportunity,
  sortOpportunitiesByUpdatedAtDesc,
  updateOpportunity,
} from './opportunitiesApi'
import type { OpportunityListItem, OpportunityPipelineOption, OpportunityStageOption } from './types'
import { crmOpportunityPath } from '../../constants/routes'

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

const validationContext = {
  pipelines: [
    {
      id: 'pipe-1',
      name: 'Life Insurance Pipeline',
      service_vertical_id: 'vert-1',
      pipeline_type: 'service',
      is_default: true,
      is_active: true,
    },
  ] satisfies OpportunityPipelineOption[],
  stages: [
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
      id: 'stage-lost',
      pipeline_id: 'pipe-1',
      name: 'Closed / Lost',
      code: 'closed_lost',
      sort_order: 10,
      is_won: false,
      is_lost: true,
      is_terminal: true,
    },
  ] satisfies OpportunityStageOption[],
  advisors: [{ id: 'adv-1', display_name: 'Alex Advisor', user_id: 'user-1' }],
  actorAdvisorId: 'adv-1' as string | null,
  role: 'owner' as const,
}

function mockOpportunityMutationClient(options: {
  insertPayload?: Record<string, unknown>
  updatePayload?: Record<string, unknown>
  rpcArgs?: Record<string, unknown>
  authUserId?: string
  profileRole?: 'owner' | 'advisor'
  sessionAdvisorId?: string | null
}) {
  const detailRow = makeRawRow({
    need_identified: true,
    source_assessment_id: null,
    source_lead_id: null,
    source_recommendation_id: null,
    assigned_at: null,
    assignment_reason: null,
    metadata: {},
  })
  const authUserId = options.authUserId ?? 'user-owner'
  const profileRole = options.profileRole ?? 'owner'
  const sessionAdvisorId = options.sessionAdvisorId === undefined ? 'adv-1' : options.sessionAdvisorId

  const chain: Record<string, unknown> = {
    then: (
      onFulfilled?: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
  }
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data: detailRow, error: null }))
  chain.maybeSingle = vi.fn(async () => {
    // profiles / advisor_profiles lookups during createOpportunity
    return { data: detailRow, error: null }
  })
  chain.insert = vi.fn((payload: Record<string, unknown>) => {
    options.insertPayload = payload
    return chain
  })
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    options.updatePayload = payload
    return chain
  })

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: authUserId } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { role: profileRole },
                  error: null,
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'advisor_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: sessionAdvisorId ? { id: sessionAdvisorId } : null,
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        }
      }
      return chain
    }),
    rpc: vi.fn(async (_name: string, args: Record<string, unknown>) => {
      options.rpcArgs = args
      return { data: detailRow, error: null }
    }),
  }
}

describe('opportunity CRUD API', () => {
  it('creates with validated insert payload', async () => {
    const options: { insertPayload?: Record<string, unknown> } = {}
    const supabase = mockOpportunityMutationClient(options) as never

    const created = await createOpportunity(
      supabase,
      {
        title: '  New Opp  ',
        household_id: 'hh-1',
        pipeline_id: 'pipe-1',
        stage_id: 'stage-1',
        service_vertical_id: 'vert-1',
        assigned_advisor_id: 'adv-1',
        next_action: ' Call ',
      },
      validationContext,
    )

    expect(created.title).toBe('Term Life Review')
    expect(options.insertPayload).toMatchObject({
      title: 'New Opp',
      household_id: 'hh-1',
      pipeline_id: 'pipe-1',
      stage_id: 'stage-1',
      service_vertical_id: 'vert-1',
      assigned_advisor_id: 'adv-1',
      assigned_by_user_id: 'user-owner',
      assignment_reason: 'manual',
      next_action: 'Call',
      need_identified: true,
    })
    expect(options.insertPayload?.assigned_at).toEqual(expect.any(String))
    expect(options.insertPayload?.stage_entered_at).toEqual(expect.any(String))
    expect(options.insertPayload).not.toHaveProperty('status')
    expect(options.insertPayload).not.toHaveProperty('closed_at')
    expect(Object.keys(options.insertPayload ?? {}).sort()).toEqual(
      [...OPPORTUNITY_INSERT_ALLOWLIST].sort(),
    )
  })

  it('derives assigned_by_user_id from auth session, not caller options', async () => {
    const options: {
      insertPayload?: Record<string, unknown>
      authUserId?: string
    } = { authUserId: 'session-user-99' }
    const supabase = mockOpportunityMutationClient(options) as never
    // If a forged form somehow tried to pass audit fields, CreateOpportunityFormValues cannot.
    const formValues = {
      title: 'Secure create',
      household_id: 'hh-1',
      pipeline_id: 'pipe-1',
      stage_id: 'stage-1',
      service_vertical_id: 'vert-1',
      assigned_advisor_id: 'adv-1' as string | null,
    }
    expect(formValues).not.toHaveProperty('assigned_by_user_id')
    expect(formValues).not.toHaveProperty('assigned_at')
    expect(formValues).not.toHaveProperty('stage_entered_at')
    expect(formValues).not.toHaveProperty('assignment_reason')

    await createOpportunity(supabase, formValues, validationContext)
    expect(options.insertPayload?.assigned_by_user_id).toBe('session-user-99')
  })

  it('blocks advisors from assigning opportunities to other advisors even if context claims owner', async () => {
    const options: {
      insertPayload?: Record<string, unknown>
      authUserId?: string
      profileRole?: 'owner' | 'advisor'
      sessionAdvisorId?: string | null
    } = {
      authUserId: 'user-a',
      profileRole: 'advisor',
      sessionAdvisorId: 'adv-1',
    }
    const supabase = mockOpportunityMutationClient(options) as never
    await expect(
      createOpportunity(
        supabase,
        {
          title: 'Cross assign',
          household_id: 'hh-1',
          pipeline_id: 'pipe-1',
          stage_id: 'stage-1',
          service_vertical_id: 'vert-1',
          assigned_advisor_id: 'adv-b-other',
        },
        {
          ...validationContext,
          role: 'owner', // forged caller claim — must be ignored
          actorAdvisorId: null,
          advisors: [
            ...validationContext.advisors,
            { id: 'adv-b-other', display_name: 'Other', user_id: 'user-b' },
          ],
        },
      ),
    ).rejects.toThrow(/themselves|not available|Invalid|fix/i)
    expect(options.insertPayload).toBeUndefined()
  })

  it('rejects invalid create before calling supabase', async () => {
    const options: { insertPayload?: Record<string, unknown> } = {}
    const supabase = mockOpportunityMutationClient(options) as never
    await expect(
      createOpportunity(
        supabase,
        {
          title: '',
          household_id: '',
          pipeline_id: '',
          stage_id: '',
          service_vertical_id: '',
          assigned_advisor_id: null,
        },
        validationContext,
      ),
    ).rejects.toThrow(/fix|Invalid/i)
    expect(options.insertPayload).toBeUndefined()
  })

  it('updates only mutable fields', async () => {
    const options: { updatePayload?: Record<string, unknown> } = {}
    const supabase = mockOpportunityMutationClient(options) as never
    await updateOpportunity(supabase, 'opp-1', {
      title: '  Renamed  ',
      next_action: 'Follow up',
      next_action_due_at: '2026-09-01',
      need_identified: false,
    })
    expect(options.updatePayload).toEqual({
      title: 'Renamed',
      next_action: 'Follow up',
      next_action_due_at: '2026-09-01',
      need_identified: false,
    })
  })

  it('moves stage via move_opportunity_stage RPC', async () => {
    const options: { rpcArgs?: Record<string, unknown> } = {}
    const supabase = mockOpportunityMutationClient(options) as never
    await moveOpportunityStage(supabase, 'opp-1', 'stage-won', validationContext.stages, 'pipe-1')
    expect(options.rpcArgs).toEqual({
      p_opportunity_id: 'opp-1',
      p_stage_id: 'stage-won',
    })
  })

  it('refuses client soft-delete until soft_delete_opportunity RPC exists', async () => {
    const supabase = mockOpportunityMutationClient({}) as never
    await expect(softDeleteOpportunity(supabase, 'opp-1')).rejects.toThrow(/soft_delete_opportunity/i)
  })
})

describe('close / archive helpers', () => {
  it('documents archive support and finds won/lost stages', () => {
    expect(OPPORTUNITY_ARCHIVE_SUPPORT.hasArchiveFlag).toBe(false)
    expect(OPPORTUNITY_ARCHIVE_SUPPORT.closeViaStageRpc).toBe(true)
    expect(OPPORTUNITY_ARCHIVE_SUPPORT.softDeleteViaDeletedAt).toBe(false)
    expect(OPPORTUNITY_ARCHIVE_SUPPORT.softDeleteBlockedByRls).toBe(true)
    expect(findCloseStage(validationContext.stages, 'won')?.id).toBe('stage-won')
    expect(findCloseStage(validationContext.stages, 'lost')?.id).toBe('stage-lost')
  })

  it('picks default pipeline and stage without inventing ids', () => {
    expect(pickDefaultPipeline(validationContext.pipelines)?.id).toBe('pipe-1')
    expect(pickDefaultStage(validationContext.stages)?.code).toBe('opportunity_identified')
  })
})

describe('navigation helpers used by CRUD flows', () => {
  it('builds opportunity workspace paths after create', () => {
    expect(crmOpportunityPath('opp-123')).toBe('/crm/opportunities/opp-123')
  })
})


describe('CRM-8.2A update allowlist', () => {
  it('documents the four mutable fields and forbidden protected keys', () => {
    expect([...OPPORTUNITY_UPDATE_ALLOWLIST]).toEqual([
      'title',
      'next_action',
      'next_action_due_at',
      'need_identified',
    ])
    expect(OPPORTUNITY_UPDATE_FORBIDDEN).toEqual(
      expect.arrayContaining([
        'household_id',
        'pipeline_id',
        'stage_id',
        'status',
        'assigned_advisor_id',
        'closed_at',
        'service_vertical_id',
      ]),
    )
  })

  it('update payload contains only allowlisted keys', async () => {
    const options: { updatePayload?: Record<string, unknown> } = {}
    const supabase = mockOpportunityMutationClient(options) as never
    await updateOpportunity(supabase, 'opp-1', {
      title: 'Renamed',
      next_action: 'Follow up',
      next_action_due_at: '2026-09-01',
      need_identified: false,
    })
    expect(Object.keys(options.updatePayload ?? {}).sort()).toEqual(
      [...OPPORTUNITY_UPDATE_ALLOWLIST].sort(),
    )
    for (const key of OPPORTUNITY_UPDATE_FORBIDDEN) {
      expect(options.updatePayload).not.toHaveProperty(key)
    }
  })
})
