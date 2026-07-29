import { describe, expect, it } from 'vitest'
import {
  emptyOverviewAnswers,
  HOUSEHOLD_ONBOARDING_ANSWERS_VERSION,
} from './onboardingFormTypes'
import { createEmptyOnboardingAnswers, normalizeOnboardingAnswers } from './onboardingSchema'

describe('normalizeOnboardingAnswers', () => {
  it('creates versioned empty documents with typed section defaults', () => {
    const empty = createEmptyOnboardingAnswers({
      startedAt: '2026-07-01T00:00:00.000Z',
      lastSection: 'income',
    })
    expect(empty.meta).toEqual({
      version: HOUSEHOLD_ONBOARDING_ANSWERS_VERSION,
      startedAt: '2026-07-01T00:00:00.000Z',
      lastSavedAt: null,
      lastSection: 'income',
      completedSections: [],
    })
    expect(empty.overview).toEqual(emptyOverviewAnswers())
    expect(empty.income.noCurrentIncome).toBe(false)
    expect(empty.income.sources).toEqual([])
    expect(empty.cashFlow.takeHomeIncomeCents).toBeNull()
    expect(empty.assets.items).toEqual([])
    expect(empty.debts.noDebts).toBe(false)
    expect(empty.insurance.noCurrentCoverage).toBe(false)
    expect(empty.retirement.planningStatus).toBe('')
    expect(empty.estate.items.length).toBeGreaterThan(0)
    expect(empty.goals.priorities).toEqual([])
  })

  it('applies safe defaults when meta is missing and normalizes legacy income shape', () => {
    const normalized = normalizeOnboardingAnswers(
      { income: { employer: 'Acme' } },
      { now: () => new Date('2026-07-10T12:00:00.000Z') },
    )
    expect(normalized.meta.version).toBe(HOUSEHOLD_ONBOARDING_ANSWERS_VERSION)
    expect(normalized.meta.startedAt).toBe('2026-07-10T12:00:00.000Z')
    expect(normalized.meta.lastSavedAt).toBeNull()
    expect(normalized.meta.lastSection).toBe('overview')
    expect(normalized.meta.completedSections).toEqual([])
    expect(normalized.income).toEqual({
      noCurrentIncome: false,
      sources: [],
      notes: '',
    })
  })

  it('preserves existing valid meta values and typed section fields', () => {
    const normalized = normalizeOnboardingAnswers({
      meta: {
        version: 1,
        startedAt: '2026-06-01T08:00:00.000Z',
        lastSavedAt: '2026-06-02T09:00:00.000Z',
        lastSection: 'assets',
        completedSections: ['overview', 'members', 'overview', 'not-a-section'],
      },
      overview: {
        maritalOrHouseholdStatus: 'married',
        dependentsCount: 0,
        preferredContactMethod: 'email',
        householdName: 'Should not persist as CRM field',
      },
      assets: {
        items: [
          {
            id: 'a1',
            category: 'checking',
            balanceCents: 125050,
          },
        ],
      },
    })
    expect(normalized.meta).toEqual({
      version: 1,
      startedAt: '2026-06-01T08:00:00.000Z',
      lastSavedAt: '2026-06-02T09:00:00.000Z',
      lastSection: 'assets',
      completedSections: ['overview', 'members'],
    })
    expect(normalized.overview.dependentsCount).toBe(0)
    expect(normalized.overview).not.toHaveProperty('householdName')
    expect(normalized.assets.items[0]?.balanceCents).toBe(125050)
    expect(normalized.assets.items[0]?.category).toBe('checking')
  })

  it('normalizes legacy empty Phase 4 objects into typed defaults', () => {
    const normalized = normalizeOnboardingAnswers({
      insurance: {},
      retirement: {},
      estate: {},
      goals: {},
    })
    expect(normalized.insurance.coverages).toEqual([])
    expect(normalized.retirement.desiredRetirementAge).toBeNull()
    expect(normalized.estate.items.some((item) => item.key === 'will')).toBe(true)
    expect(normalized.goals.noCurrentGoals).toBe(false)
  })
})
