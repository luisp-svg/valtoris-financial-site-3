import { describe, expect, it, vi } from 'vitest'
import {
  completeHouseholdOnboardingDraft,
  createHouseholdOnboardingDraft,
  fetchLatestCompletedHouseholdOnboarding,
  fetchLatestHouseholdOnboardingDraft,
  HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
  HouseholdOnboardingError,
  normalizeHouseholdOnboardingAssessment,
  updateHouseholdOnboardingDraft,
} from './onboardingApi'
import {
  normalizeWorkspaceAssessment,
  selectLatestWorkspaceAssessments,
  WORKSPACE_ASSESSMENT_TYPES,
} from './householdsApi'

const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const DRAFT_ID = '11111111-1111-1111-1111-111111111111'
const COMPLETED_ID = '22222222-2222-2222-2222-222222222222'

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DRAFT_ID,
    household_id: HOUSEHOLD_ID,
    assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
    status: 'draft',
    completed_at: null,
    answers: {},
    derived_metrics: {},
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function completedOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPLETED_ID,
    household_id: HOUSEHOLD_ID,
    assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
    status: 'completed',
    completed_at: '2026-07-02T12:00:00.000Z',
    answers: { profile: { state: 'TX' } },
    derived_metrics: { protectionNeed: 500000 },
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-02T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

type QueryResult = { data: unknown; error: unknown }

/**
 * Chainable Supabase mock that records filters/payloads and resolves terminal calls.
 */
function createAssessmentsClient(options: {
  maybeSingleResult?: QueryResult | (() => QueryResult)
  singleResult?: QueryResult | (() => QueryResult)
  onInsert?: (payload: Record<string, unknown>) => void
  onUpdate?: (payload: Record<string, unknown>) => void
}) {
  const state = {
    filters: [] as Array<{ op: string; args: unknown[] }>,
    insertPayload: null as Record<string, unknown> | null,
    updatePayload: null as Record<string, unknown> | null,
  }

  const resolve = (value: QueryResult | (() => QueryResult) | undefined): QueryResult => {
    if (typeof value === 'function') return value()
    return value ?? { data: null, error: null }
  }

  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'eq',
    'is',
    'not',
    'order',
    'limit',
    'in',
  ] as const

  for (const method of methods) {
    chain[method] = vi.fn((...args: unknown[]) => {
      state.filters.push({ op: method, args })
      return chain
    })
  }

  chain.insert = vi.fn((payload: Record<string, unknown>) => {
    state.insertPayload = payload
    options.onInsert?.(payload)
    return chain
  })

  chain.update = vi.fn((payload: Record<string, unknown>) => {
    state.updatePayload = payload
    options.onUpdate?.(payload)
    return chain
  })

  chain.maybeSingle = vi.fn(async () => resolve(options.maybeSingleResult))
  chain.single = vi.fn(async () => resolve(options.singleResult))

  return {
    state,
    supabase: {
      from: vi.fn((table: string) => {
        expect(table).toBe('assessments')
        return chain
      }),
    },
    chain,
  }
}

describe('normalizeHouseholdOnboardingAssessment', () => {
  it('normalizes household_onboarding draft and completed rows', () => {
    expect(normalizeHouseholdOnboardingAssessment(draftRow())).toMatchObject({
      id: DRAFT_ID,
      assessment_type: 'household_onboarding',
      status: 'draft',
      completed_at: null,
      answers: {},
      derived_metrics: {},
    })
    expect(normalizeHouseholdOnboardingAssessment(completedOnboardingRow())).toMatchObject({
      id: COMPLETED_ID,
      status: 'completed',
      completed_at: '2026-07-02T12:00:00.000Z',
      answers: { profile: { state: 'TX' } },
      derived_metrics: { protectionNeed: 500000 },
    })
  })

  it('rejects wrong type, soft-deleted, and invalid status/completed_at pairs', () => {
    expect(
      normalizeHouseholdOnboardingAssessment(draftRow({ assessment_type: 'family' })),
    ).toBeNull()
    expect(
      normalizeHouseholdOnboardingAssessment(draftRow({ deleted_at: '2026-07-03T00:00:00.000Z' })),
    ).toBeNull()
    expect(
      normalizeHouseholdOnboardingAssessment(
        draftRow({ status: 'draft', completed_at: '2026-07-01T00:00:00.000Z' }),
      ),
    ).toBeNull()
    expect(
      normalizeHouseholdOnboardingAssessment(
        completedOnboardingRow({ status: 'completed', completed_at: null }),
      ),
    ).toBeNull()
    expect(
      normalizeHouseholdOnboardingAssessment(draftRow({ status: 'archived' })),
    ).toBeNull()
  })

  it('treats missing JSON documents as empty objects (no fabrication)', () => {
    const normalized = normalizeHouseholdOnboardingAssessment(
      draftRow({ answers: null, derived_metrics: null }),
    )
    expect(normalized?.answers).toEqual({})
    expect(normalized?.derived_metrics).toEqual({})
  })
})

describe('createHouseholdOnboardingDraft', () => {
  it('returns existing active draft instead of inserting a duplicate', async () => {
    const existing = draftRow({ answers: { step: 1 } })
    let call = 0
    const { supabase, state } = createAssessmentsClient({
      maybeSingleResult: () => {
        call += 1
        return { data: existing, error: null }
      },
    })

    const result = await createHouseholdOnboardingDraft(supabase as never, {
      household_id: HOUSEHOLD_ID,
    })

    expect(result.id).toBe(DRAFT_ID)
    expect(result.answers).toEqual({ step: 1 })
    expect(state.insertPayload).toBeNull()
    expect(call).toBe(1)
  })

  it('inserts a draft with empty JSON when none exists and writes no scores', async () => {
    const created = draftRow()
    let fetchCount = 0
    const { supabase, state } = createAssessmentsClient({
      maybeSingleResult: () => {
        fetchCount += 1
        return { data: null, error: null }
      },
      singleResult: { data: created, error: null },
    })

    const result = await createHouseholdOnboardingDraft(supabase as never, {
      household_id: `  ${HOUSEHOLD_ID}  `,
    })

    expect(result.status).toBe('draft')
    expect(result.completed_at).toBeNull()
    expect(state.insertPayload).toEqual({
      household_id: HOUSEHOLD_ID,
      assessment_type: 'household_onboarding',
      status: 'draft',
      completed_at: null,
      answers: {},
      derived_metrics: {},
    })
    expect(state.insertPayload).not.toHaveProperty('overall_score')
    expect(state.insertPayload).not.toHaveProperty('overall_grade')
    expect(fetchCount).toBe(1)
  })

  it('recovers from unique violation by returning the raced draft', async () => {
    const raced = draftRow({ id: '33333333-3333-3333-3333-333333333333' })
    let fetchCount = 0
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: () => {
        fetchCount += 1
        if (fetchCount === 1) return { data: null, error: null }
        return { data: raced, error: null }
      },
      singleResult: {
        data: null,
        error: { message: 'duplicate', code: '23505' },
      },
    })

    const result = await createHouseholdOnboardingDraft(supabase as never, {
      household_id: HOUSEHOLD_ID,
    })
    expect(result.id).toBe('33333333-3333-3333-3333-333333333333')
    expect(fetchCount).toBe(2)
  })
})

describe('updateHouseholdOnboardingDraft', () => {
  it('replaces answers and/or derived_metrics fully and rejects empty updates', async () => {
    const updated = draftRow({
      answers: { cashFlow: { income: 120000 } },
      derived_metrics: { protectionNeed: 400000 },
    })
    const { supabase, state } = createAssessmentsClient({
      maybeSingleResult: { data: updated, error: null },
    })

    await expect(
      updateHouseholdOnboardingDraft(supabase as never, DRAFT_ID, HOUSEHOLD_ID, {}),
    ).rejects.toBeInstanceOf(HouseholdOnboardingError)

    const result = await updateHouseholdOnboardingDraft(supabase as never, DRAFT_ID, HOUSEHOLD_ID, {
      answers: { cashFlow: { income: 120000 } },
      derived_metrics: { protectionNeed: 400000 },
    })

    expect(state.updatePayload).toEqual({
      answers: { cashFlow: { income: 120000 } },
      derived_metrics: { protectionNeed: 400000 },
    })
    expect(state.updatePayload).not.toHaveProperty('overall_score')
    expect(state.updatePayload).not.toHaveProperty('overall_grade')
    expect(state.updatePayload).not.toHaveProperty('status')
    expect(result.answers).toEqual({ cashFlow: { income: 120000 } })
    expect(result.derived_metrics).toEqual({ protectionNeed: 400000 })
  })

  it('rejects updates when no draft row matches (completed/soft-deleted)', async () => {
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: { data: null, error: null },
    })

    await expect(
      updateHouseholdOnboardingDraft(supabase as never, COMPLETED_ID, HOUSEHOLD_ID, {
        answers: { a: 1 },
      }),
    ).rejects.toMatchObject({
      name: 'HouseholdOnboardingError',
      code: 'draft_not_updatable',
    })
  })
})

describe('fetchLatestHouseholdOnboardingDraft / fetchLatestCompletedHouseholdOnboarding', () => {
  it('returns draft and excludes completed from draft fetch semantics via normalization', async () => {
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: { data: draftRow(), error: null },
    })
    const draft = await fetchLatestHouseholdOnboardingDraft(supabase as never, HOUSEHOLD_ID)
    expect(draft?.status).toBe('draft')
    expect(draft?.completed_at).toBeNull()
  })

  it('returns completed onboarding and keeps completed_at', async () => {
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: { data: completedOnboardingRow(), error: null },
    })
    const completed = await fetchLatestCompletedHouseholdOnboarding(
      supabase as never,
      HOUSEHOLD_ID,
    )
    expect(completed?.status).toBe('completed')
    expect(completed?.completed_at).toBe('2026-07-02T12:00:00.000Z')
  })

  it('returns null when soft-deleted row leaks through', async () => {
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: {
        data: draftRow({ deleted_at: '2026-07-03T00:00:00.000Z' }),
        error: null,
      },
    })
    await expect(
      fetchLatestHouseholdOnboardingDraft(supabase as never, HOUSEHOLD_ID),
    ).resolves.toBeNull()
  })
})

describe('completeHouseholdOnboardingDraft', () => {
  it('sets status completed with timestamp and preserves JSON without scores', async () => {
    const completedAt = new Date('2026-07-04T15:30:00.000Z')
    const completed = completedOnboardingRow({
      id: DRAFT_ID,
      completed_at: completedAt.toISOString(),
      answers: { estate: { hasWill: 'yes' } },
      derived_metrics: {},
    })
    const { supabase, state } = createAssessmentsClient({
      maybeSingleResult: { data: completed, error: null },
    })

    const result = await completeHouseholdOnboardingDraft(
      supabase as never,
      DRAFT_ID,
      HOUSEHOLD_ID,
      { completedAt },
    )

    expect(state.updatePayload).toEqual({
      status: 'completed',
      completed_at: '2026-07-04T15:30:00.000Z',
    })
    expect(state.updatePayload).not.toHaveProperty('overall_score')
    expect(state.updatePayload).not.toHaveProperty('overall_grade')
    expect(state.updatePayload).not.toHaveProperty('answers')
    expect(result.status).toBe('completed')
    expect(result.completed_at).toBe('2026-07-04T15:30:00.000Z')
    expect(result.answers).toEqual({ estate: { hasWill: 'yes' } })
  })

  it('rejects completing an already completed or missing draft', async () => {
    const { supabase } = createAssessmentsClient({
      maybeSingleResult: { data: null, error: null },
    })
    await expect(
      completeHouseholdOnboardingDraft(supabase as never, COMPLETED_ID, HOUSEHOLD_ID),
    ).rejects.toMatchObject({
      name: 'HouseholdOnboardingError',
      code: 'draft_not_completable',
    })
  })
})

describe('workspace assessment selection vs onboarding', () => {
  it('workspace types exclude household_onboarding', () => {
    expect(WORKSPACE_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
      'credit',
    ])
    expect(WORKSPACE_ASSESSMENT_TYPES).not.toContain('household_onboarding')
  })

  it('normalizeWorkspaceAssessment rejects onboarding and drafts', () => {
    expect(normalizeWorkspaceAssessment(draftRow())).toBeNull()
    expect(normalizeWorkspaceAssessment(completedOnboardingRow())).toBeNull()
    expect(
      normalizeWorkspaceAssessment({
        id: 'f1',
        assessment_type: 'family',
        status: 'draft',
        completed_at: null,
        overall_score: null,
        overall_grade: null,
        answers: {},
        derived_metrics: {},
      }),
    ).toBeNull()
  })

  it('keeps latest completed family/business/retirement/protection selection unchanged', () => {
    // Rows ordered as fetchAssessmentsForHousehold returns them (completed_at DESC).
    const selected = selectLatestWorkspaceAssessments([
      {
        id: 'family-deleted',
        assessment_type: 'family',
        status: 'completed',
        completed_at: '2026-08-01T00:00:00.000Z',
        overall_score: 90,
        overall_grade: 'A',
        answers: {},
        derived_metrics: {},
        deleted_at: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 'ret-1',
        assessment_type: 'retirement',
        status: 'completed',
        completed_at: '2026-07-15T00:00:00.000Z',
        overall_score: 80,
        overall_grade: 'B',
        answers: { household: { currentAge: '50' } },
        derived_metrics: null,
        deleted_at: null,
      },
      completedOnboardingRow({ id: 'onboarding-done' }),
      {
        id: 'family-new',
        assessment_type: 'family',
        status: 'completed',
        completed_at: '2026-07-01T00:00:00.000Z',
        overall_score: 70,
        overall_grade: 'C',
        answers: { financial: { householdIncome: '120000' } },
        derived_metrics: {},
        deleted_at: null,
      },
      draftRow({ id: 'onboarding-draft' }),
      {
        id: 'family-old',
        assessment_type: 'family',
        status: 'completed',
        completed_at: '2026-06-01T00:00:00.000Z',
        overall_score: 50,
        overall_grade: 'D',
        answers: { financial: { householdIncome: '100000' } },
        derived_metrics: {},
        deleted_at: null,
      },
    ])

    expect(selected.familyAssessment?.id).toBe('family-new')
    expect(selected.familyAssessment?.completed_at).toBe('2026-07-01T00:00:00.000Z')
    expect(selected.retirementAssessment?.id).toBe('ret-1')
    expect(selected.businessAssessment).toBeNull()
    expect(selected.protectionAssessment).toBeNull()
  })
})
