import { describe, expect, it } from 'vitest'
import {
  formatOnboardingReadiness,
  reviewSectionStatusFromCompletion,
  validateOnboardingCompletion,
} from './onboardingCompletion'
import { FORM_SECTION_IDS } from './onboardingFormTypes'
import { buildOnboardingProgressSnapshot } from './onboardingProgress'
import { buildReviewSectionSummaries } from './onboardingReviewSummaries'
import { ONBOARDING_SECTION_IDS } from './onboardingSections'
import {
  completeFormAnswersFixture,
  householdFixture,
  answersFixture,
} from './testFixtures'

describe('onboarding completion validation', () => {
  it('blocks completion when form sections are incomplete', () => {
    const answers = answersFixture()
    const household = householdFixture()
    const result = validateOnboardingCompletion(answers, { household })

    expect(result.canComplete).toBe(false)
    expect(result.readiness).toBe('incomplete')
    expect(result.incompleteSections.length).toBeGreaterThan(0)
    expect(result.blockingErrors.length).toBeGreaterThan(0)
    expect(formatOnboardingReadiness(result.readiness)).toBe('Incomplete')
  })

  it('allows completion when all form sections are complete', () => {
    const answers = completeFormAnswersFixture()
    const household = householdFixture()
    const result = validateOnboardingCompletion(answers, { household })

    expect(result.canComplete).toBe(true)
    expect(result.readiness).toBe('ready_to_complete')
    expect(result.incompleteSections).toEqual([])
    expect(result.needsAttentionSections).toEqual([])
    expect(result.completeSections).toEqual([...FORM_SECTION_IDS])
    expect(formatOnboardingReadiness(result.readiness)).toBe('Ready to complete')
    expect(reviewSectionStatusFromCompletion(result)).toBe('complete')
  })

  it('marks readiness needs_attention when a form section has invalid data', () => {
    const answers = completeFormAnswersFixture((a) => {
      a.income.noCurrentIncome = false
      a.income.sources = [
        {
          id: 's1',
          memberId: null,
          employerOrSourceName: 'Acme',
          occupation: '',
          employmentStatus: 'employed_full_time',
          grossAnnualIncomeCents: -5 as never,
          netMonthlyIncomeCents: null,
          payFrequency: '',
          variableOrCommissionIncomeCents: null,
          otherIncomeCents: null,
          expectedIncomeChanges: '',
          employerBenefitsNotes: '',
          notes: '',
        },
      ]
    })
    const household = householdFixture()
    const result = validateOnboardingCompletion(answers, { household })

    expect(result.canComplete).toBe(false)
    expect(result.readiness).toBe('needs_attention')
    expect(result.needsAttentionSections).toContain('income')
    expect(reviewSectionStatusFromCompletion(result)).toBe('needs_attention')
  })

  it('keeps educational warnings non-blocking when sections are otherwise complete', () => {
    const answers = completeFormAnswersFixture((a) => {
      a.overview.dependentsCount = 2
      a.insurance.noCurrentCoverage = true
      a.insurance.protectionConcernsAcknowledged = true
    })
    const household = householdFixture({
      members: [
        {
          id: 'm1',
          household_id: 'hh-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          relationship: 'primary',
          is_primary_contact: true,
          email: 'ada@example.com',
          phone: null,
          date_of_birth: '1815-12-10',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'm2',
          household_id: 'hh-1',
          first_name: 'Child',
          last_name: 'Lovelace',
          relationship: 'child',
          is_primary_contact: false,
          email: null,
          phone: null,
          date_of_birth: '2018-01-01',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    const result = validateOnboardingCompletion(answers, { household })
    expect(result.canComplete).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('financial progress review summaries', () => {
  it('builds one summary per form section from centralized metadata', () => {
    const answers = completeFormAnswersFixture()
    const household = householdFixture()
    const completion = validateOnboardingCompletion(answers, { household })
    const summaries = buildReviewSectionSummaries({ answers, household, completion })

    expect(summaries).toHaveLength(FORM_SECTION_IDS.length)
    expect(summaries.map((summary) => summary.sectionId)).toEqual([...FORM_SECTION_IDS])
    expect(summaries.every((summary) => summary.highlights.length > 0)).toBe(true)
    expect(summaries.find((summary) => summary.sectionId === 'income')?.highlights[0]?.value).toBe(
      'No current income (acknowledged)',
    )
  })
})

describe('phase 6 progress integration', () => {
  it('marks review complete when all form sections are ready', () => {
    const answers = completeFormAnswersFixture()
    const household = householdFixture()
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'review',
      assessmentStatus: 'draft',
      household,
    })
    expect(snapshot.sectionStates.review).toBe('complete')
    expect(snapshot.completedSectionsCount).toBe(ONBOARDING_SECTION_IDS.length)
    expect(snapshot.progressPercent).toBe(100)
  })

  it('marks review in progress when some form sections remain incomplete', () => {
    const answers = answersFixture((a) => {
      a.overview.maritalOrHouseholdStatus = 'married'
      a.overview.dependentsCount = 0
      a.overview.preferredContactMethod = 'email'
    })
    const household = householdFixture()
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'review',
      assessmentStatus: 'draft',
      household,
    })
    expect(snapshot.sectionStates.overview).toBe('complete')
    expect(snapshot.sectionStates.review).toBe('in_progress')
  })
})
