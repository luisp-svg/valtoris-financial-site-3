import { describe, expect, it, vi } from 'vitest'
import {
  fetchOnboardingEntryStatus,
  loadHouseholdOnboardingSession,
  onboardingEntryLabel,
} from './loadHouseholdOnboarding'

const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function householdDetail() {
  return {
    id: HOUSEHOLD_ID,
    display_name: 'Ada Household',
    status: 'client',
    primary_email: 'ada@example.com',
    primary_phone: null,
    assigned_advisor_id: null,
    relationship_stage_id: 'stage',
    updated_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    assigned_advisor: null,
    relationship_stage: null,
    members: [],
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
  }
}

function assessmentRow(status: 'draft' | 'completed', answers: Record<string, unknown> = {}) {
  return {
    id: status === 'draft' ? 'draft-1' : 'completed-1',
    household_id: HOUSEHOLD_ID,
    assessment_type: 'household_onboarding' as const,
    status,
    completed_at: status === 'completed' ? '2026-07-02T00:00:00.000Z' : null,
    answers,
    derived_metrics: {},
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }
}

vi.mock('../householdsApi', () => ({
  fetchHouseholdById: vi.fn(),
}))

vi.mock('../onboardingApi', () => ({
  fetchLatestCompletedHouseholdOnboarding: vi.fn(),
  fetchLatestHouseholdOnboardingDraft: vi.fn(),
  createHouseholdOnboardingDraft: vi.fn(),
  formatOnboardingError: (source: string, error: unknown) =>
    `${source}:${error instanceof Error ? error.message : 'error'}`,
}))

import { fetchHouseholdById } from '../householdsApi'
import {
  createHouseholdOnboardingDraft,
  fetchLatestCompletedHouseholdOnboarding,
  fetchLatestHouseholdOnboardingDraft,
} from '../onboardingApi'

describe('loadHouseholdOnboardingSession', () => {
  it('returns not_found when household is inaccessible', async () => {
    vi.mocked(fetchHouseholdById).mockResolvedValue(null)
    const result = await loadHouseholdOnboardingSession({} as never, HOUSEHOLD_ID)
    expect(result).toMatchObject({ ok: false, reason: 'not_found' })
    expect(fetchLatestCompletedHouseholdOnboarding).not.toHaveBeenCalled()
    expect(createHouseholdOnboardingDraft).not.toHaveBeenCalled()
  })

  it('loads completed onboarding without creating a draft', async () => {
    vi.mocked(fetchHouseholdById).mockResolvedValue(householdDetail() as never)
    vi.mocked(fetchLatestCompletedHouseholdOnboarding).mockResolvedValue(
      assessmentRow('completed', { meta: { lastSection: 'goals' } }) as never,
    )

    const result = await loadHouseholdOnboardingSession({} as never, HOUSEHOLD_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mode).toBe('completed')
    expect(result.assessment.id).toBe('completed-1')
    expect(createHouseholdOnboardingDraft).not.toHaveBeenCalled()
    expect(fetchLatestHouseholdOnboardingDraft).not.toHaveBeenCalled()
  })

  it('resumes an existing draft without inserting', async () => {
    vi.mocked(fetchHouseholdById).mockResolvedValue(householdDetail() as never)
    vi.mocked(fetchLatestCompletedHouseholdOnboarding).mockResolvedValue(null)
    vi.mocked(fetchLatestHouseholdOnboardingDraft).mockResolvedValue(
      assessmentRow('draft', {
        meta: {
          version: 1,
          startedAt: '2026-07-01T00:00:00.000Z',
          lastSavedAt: null,
          lastSection: 'cash-flow',
          completedSections: [],
        },
      }) as never,
    )

    const result = await loadHouseholdOnboardingSession({} as never, HOUSEHOLD_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mode).toBe('draft')
    expect(result.answers.meta.lastSection).toBe('cash-flow')
    expect(createHouseholdOnboardingDraft).not.toHaveBeenCalled()
  })

  it('get-or-creates a draft when none exists', async () => {
    vi.mocked(fetchHouseholdById).mockResolvedValue(householdDetail() as never)
    vi.mocked(fetchLatestCompletedHouseholdOnboarding).mockResolvedValue(null)
    vi.mocked(fetchLatestHouseholdOnboardingDraft).mockResolvedValue(null)
    vi.mocked(createHouseholdOnboardingDraft).mockResolvedValue(
      assessmentRow('draft', {}) as never,
    )

    const result = await loadHouseholdOnboardingSession({} as never, HOUSEHOLD_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mode).toBe('draft')
    expect(createHouseholdOnboardingDraft).toHaveBeenCalledWith(
      expect.anything(),
      { household_id: HOUSEHOLD_ID },
    )
    expect(result.answers.meta.lastSection).toBe('overview')
  })

  it('returns load_error on API failure', async () => {
    vi.mocked(fetchHouseholdById).mockRejectedValue(new Error('boom'))
    const result = await loadHouseholdOnboardingSession({} as never, HOUSEHOLD_ID)
    expect(result).toMatchObject({
      ok: false,
      reason: 'load_error',
      message: 'load_onboarding:boom',
    })
  })
})

describe('onboarding entry status', () => {
  it('labels Start / Resume / View from draft and completed presence', async () => {
    vi.mocked(fetchLatestHouseholdOnboardingDraft).mockResolvedValue(null)
    vi.mocked(fetchLatestCompletedHouseholdOnboarding).mockResolvedValue(null)
    await expect(fetchOnboardingEntryStatus({} as never, HOUSEHOLD_ID)).resolves.toEqual({
      kind: 'none',
    })
    expect(onboardingEntryLabel({ kind: 'none' })).toBe('Start Household Onboarding')

    vi.mocked(fetchLatestHouseholdOnboardingDraft).mockResolvedValue(
      assessmentRow('draft') as never,
    )
    await expect(fetchOnboardingEntryStatus({} as never, HOUSEHOLD_ID)).resolves.toEqual({
      kind: 'draft',
    })
    expect(onboardingEntryLabel({ kind: 'draft' })).toBe('Resume Household Onboarding')

    vi.mocked(fetchLatestHouseholdOnboardingDraft).mockResolvedValue(null)
    vi.mocked(fetchLatestCompletedHouseholdOnboarding).mockResolvedValue(
      assessmentRow('completed') as never,
    )
    await expect(fetchOnboardingEntryStatus({} as never, HOUSEHOLD_ID)).resolves.toEqual({
      kind: 'completed',
    })
    expect(onboardingEntryLabel({ kind: 'completed' })).toBe('View Household Onboarding')
  })
})
