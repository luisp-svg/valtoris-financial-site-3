import { describe, expect, it } from 'vitest'
import { emptyIncomeSource } from './onboardingFormTypes'
import {
  buildOnboardingProgressSnapshot,
  deriveCompletedSectionIds,
  getSectionUiState,
} from './onboardingProgress'
import { ONBOARDING_SECTION_IDS } from './onboardingSections'
import { answersFixture, householdFixture, memberFixture } from './testFixtures'

function completePhase3Answers() {
  return answersFixture((a) => {
    a.overview.maritalOrHouseholdStatus = 'married'
    a.overview.dependentsCount = 0
    a.overview.preferredContactMethod = 'email'
    a.income.noCurrentIncome = true
    a.cashFlow.takeHomeIncomeCents = 0
    a.cashFlow.housingCents = 0
    a.cashFlow.utilitiesCents = 0
    a.cashFlow.foodCents = 0
    a.cashFlow.transportationCents = 0
    a.assets.noAssets = true
    a.debts.noDebts = true
  })
}

describe('onboarding progress', () => {
  it('keeps empty draft Phase 3 sections not_started and placeholders not_started', () => {
    const answers = answersFixture()
    const household = householdFixture({ members: [] })
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'income',
      assessmentStatus: 'draft',
      household,
    })

    expect(snapshot.totalSections).toBe(ONBOARDING_SECTION_IDS.length)
    expect(snapshot.completedSectionsCount).toBe(0)
    expect(snapshot.progressPercent).toBe(0)
    expect(snapshot.sectionStates.income).toBe('not_started')
    expect(snapshot.sectionStates.overview).toBe('not_started')
    expect(snapshot.sectionStates.insurance).toBe('not_started')
    expect(snapshot.sectionStates.review).toBe('not_started')
  })

  it('drives status from validation, including needs_attention and completed count', () => {
    const answers = answersFixture((a) => {
      a.overview.maritalOrHouseholdStatus = 'single'
      a.income.sources = [
        emptyIncomeSource({
          id: 's1',
          employerOrSourceName: 'Acme',
          grossAnnualIncomeCents: -10 as never,
        }),
      ]
    })
    const household = householdFixture()

    expect(
      getSectionUiState({
        sectionId: 'overview',
        answers,
        currentSectionId: 'income',
        assessmentStatus: 'draft',
        household,
      }),
    ).toBe('in_progress')

    expect(
      getSectionUiState({
        sectionId: 'income',
        answers,
        currentSectionId: 'income',
        assessmentStatus: 'draft',
        household,
      }),
    ).toBe('needs_attention')

    expect(
      getSectionUiState({
        sectionId: 'members',
        answers,
        currentSectionId: 'income',
        assessmentStatus: 'draft',
        household,
      }),
    ).toBe('complete')

    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'income',
      assessmentStatus: 'draft',
      household,
    })
    expect(snapshot.completedSectionsCount).toBe(1)
    expect(snapshot.sectionStates.insurance).toBe('not_started')
  })

  it('marks members complete after household refresh adds a primary member', () => {
    const answers = answersFixture()
    const before = householdFixture({
      members: [memberFixture({ id: 'm1', is_primary_contact: false })],
    })
    expect(
      getSectionUiState({
        sectionId: 'members',
        answers,
        currentSectionId: 'members',
        assessmentStatus: 'draft',
        household: before,
      }),
    ).toBe('in_progress')

    const after = householdFixture({
      members: [memberFixture({ id: 'm1', is_primary_contact: true })],
    })
    expect(
      getSectionUiState({
        sectionId: 'members',
        answers,
        currentSectionId: 'members',
        assessmentStatus: 'draft',
        household: after,
      }),
    ).toBe('complete')
  })

  it('treats completed assessments as fully complete for progress display', () => {
    const answers = answersFixture()
    const household = householdFixture()
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'review',
      assessmentStatus: 'completed',
      household,
    })
    expect(snapshot.completedSectionsCount).toBe(ONBOARDING_SECTION_IDS.length)
    expect(snapshot.progressPercent).toBe(100)
    expect(
      deriveCompletedSectionIds({
        answers,
        assessmentStatus: 'completed',
        currentSectionId: 'review',
        household,
      }),
    ).toEqual([...ONBOARDING_SECTION_IDS])
  })

  it('counts Phase 3 completions while Phase 4 stays empty and review stays not started', () => {
    const answers = completePhase3Answers()
    const household = householdFixture()
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'review',
      assessmentStatus: 'draft',
      household,
    })
    expect(snapshot.sectionStates.overview).toBe('complete')
    expect(snapshot.sectionStates.members).toBe('complete')
    expect(snapshot.sectionStates.income).toBe('complete')
    expect(snapshot.sectionStates['cash-flow']).toBe('complete')
    expect(snapshot.sectionStates.assets).toBe('complete')
    expect(snapshot.sectionStates.debts).toBe('complete')
    expect(snapshot.sectionStates.insurance).toBe('not_started')
    expect(snapshot.sectionStates.retirement).toBe('not_started')
    expect(snapshot.sectionStates.estate).toBe('not_started')
    expect(snapshot.sectionStates.goals).toBe('not_started')
    expect(snapshot.sectionStates.review).toBe('in_progress')
  })
})
