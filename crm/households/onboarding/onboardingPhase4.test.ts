import { describe, expect, it } from 'vitest'
import {
  ESTATE_LEGAL_DISCLOSURE,
  emptyAssetItem,
  emptyInsuranceCoverage,
  emptyPriorityItem,
  emptyImmediateConcern,
} from './onboardingFormTypes'
import {
  ageFromDateOfBirth,
  hasBusinessOwnershipAsset,
  hasMinorHouseholdMembers,
  householdHasIncomeDependentsContext,
  isValidIsoDateOnly,
} from './onboardingCrossSection'
import {
  validateEstateSection,
  validateGoalsSection,
  validateInsuranceSection,
  validateOnboardingSection,
  validateRetirementSection,
} from './onboardingValidation'
import { buildOnboardingProgressSnapshot } from './onboardingProgress'
import { ONBOARDING_SECTION_IDS } from './onboardingSections'
import {
  answersFixture,
  completeFormAnswersFixture,
  householdFixture,
  memberFixture,
} from './testFixtures'

describe('insurance validation', () => {
  it('completes with no-current-coverage and concerns acknowledgment', () => {
    const answers = answersFixture((a) => {
      a.insurance.noCurrentCoverage = true
      a.insurance.protectionConcernsAcknowledged = true
    })
    expect(validateInsuranceSection(answers, { household: householdFixture() }).status).toBe(
      'complete',
    )
  })

  it('supports multiple coverages with blank and explicit zero amounts', () => {
    const answers = answersFixture((a) => {
      a.insurance.protectionConcernsAcknowledged = true
      a.insurance.coverages = [
        emptyInsuranceCoverage({
          id: 'c1',
          coverageType: 'life',
          coverageAmountCents: null,
          premiumCents: 0,
          employerProvided: true,
          personallyOwned: false,
          beneficiaryReviewStatus: 'unknown',
        }),
        emptyInsuranceCoverage({
          id: 'c2',
          coverageType: 'auto',
          coverageAmountCents: 0,
          personallyOwned: true,
          beneficiaryReviewStatus: 'not_applicable',
        }),
      ]
    })
    expect(validateInsuranceSection(answers, { household: householdFixture() }).status).toBe(
      'complete',
    )
  })

  it('marks missing type as in_progress and negatives as needs_attention', () => {
    const missingType = answersFixture((a) => {
      a.insurance.protectionConcernsAcknowledged = true
      a.insurance.coverages = [emptyInsuranceCoverage({ id: 'c1' })]
    })
    expect(validateInsuranceSection(missingType, { household: householdFixture() }).status).toBe(
      'in_progress',
    )

    const negative = answersFixture((a) => {
      a.insurance.protectionConcernsAcknowledged = true
      a.insurance.coverages = [
        emptyInsuranceCoverage({
          id: 'c1',
          coverageType: 'life',
          coverageAmountCents: -100 as never,
        }),
      ]
    })
    expect(validateInsuranceSection(negative, { household: householdFixture() }).status).toBe(
      'needs_attention',
    )
  })

  it('rejects employer-provided marked as personally owned and warns for dependents', () => {
    const answers = answersFixture((a) => {
      a.overview.dependentsCount = 2
      a.insurance.protectionConcernsAcknowledged = true
      a.insurance.coverages = [
        emptyInsuranceCoverage({
          id: 'c1',
          coverageType: 'life',
          employerProvided: true,
          personallyOwned: true,
          coverageAmountCents: 1000,
        }),
      ]
    })
    const result = validateInsuranceSection(answers, { household: householdFixture() })
    expect(result.status).toBe('needs_attention')
    expect(result.warnings.dependentsIncome).toBeTruthy()
  })
})

describe('retirement validation', () => {
  it('accepts a valid plan and already-retired without desired age', () => {
    const valid = answersFixture((a) => {
      a.retirement.planningStatus = 'actively_saving'
      a.retirement.desiredRetirementAge = 65
      a.retirement.desiredMonthlyIncomeCents = 500000
      a.retirement.currentMonthlyContributionCents = 0
      a.retirement.contributionAcknowledged = true
      a.retirement.retirementConfidence = 'somewhat_confident'
    })
    const household = householdFixture({
      members: [memberFixture({ id: 'm1', date_of_birth: '1980-01-01' })],
    })
    expect(validateRetirementSection(valid, { household }).status).toBe('complete')

    const retired = answersFixture((a) => {
      a.retirement.planningStatus = 'already_retired'
      a.retirement.desiredIncomeUnknown = true
      a.retirement.contributionAcknowledged = true
      a.retirement.retirementConfidence = 'somewhat_confident'
    })
    expect(validateRetirementSection(retired, { household }).status).toBe('complete')
  })

  it('rejects desired age below current age and negative contributions', () => {
    const household = householdFixture({
      members: [memberFixture({ id: 'm1', date_of_birth: '1980-01-01' })],
    })
    const age = ageFromDateOfBirth('1980-01-01')!
    const answers = answersFixture((a) => {
      a.retirement.planningStatus = 'actively_saving'
      a.retirement.desiredRetirementAge = age - 1
      a.retirement.desiredMonthlyIncomeCents = 1000
      a.retirement.contributionAcknowledged = true
      a.retirement.retirementConfidence = 'uncertain'
    })
    expect(validateRetirementSection(answers, { household }).status).toBe('needs_attention')

    const negative = answersFixture((a) => {
      a.retirement.planningStatus = 'actively_saving'
      a.retirement.desiredRetirementAge = 70
      a.retirement.desiredMonthlyIncomeCents = 1000
      a.retirement.currentMonthlyContributionCents = -1 as never
      a.retirement.contributionAcknowledged = true
      a.retirement.primaryConcerns = 'longevity'
    })
    expect(validateRetirementSection(negative, { household }).status).toBe('needs_attention')
  })

  it('references retirement assets without requiring duplicated balances', () => {
    const answers = answersFixture((a) => {
      a.assets.items = [
        emptyAssetItem({
          id: 'a1',
          category: 'retirement_account',
          balanceCents: 250000,
        }),
      ]
      a.retirement.planningStatus = 'actively_saving'
      a.retirement.desiredRetirementAge = 67
      a.retirement.desiredMonthlyIncomeCents = 400000
      a.retirement.contributionAcknowledged = true
      a.retirement.retirementConfidence = 'uncertain'
    })
    const result = validateRetirementSection(answers, { household: householdFixture() })
    expect(result.status).toBe('complete')
    expect(result.warnings.retirementAssets).toMatch(/Assets and Savings/)
  })
})

describe('estate validation', () => {
  it('normalizes not-applicable and completes with required statuses', () => {
    const answers = answersFixture((a) => {
      a.estate.itemsAcknowledged = true
      a.estate.legacyGoals = 'Provide for family'
      for (const item of a.estate.items) {
        if (
          item.key === 'will' ||
          item.key === 'financial_poa' ||
          item.key === 'healthcare_poa' ||
          item.key === 'advance_directive' ||
          item.key === 'beneficiary_review'
        ) {
          item.status = 'in_place'
        } else {
          item.status = 'not_applicable'
        }
      }
    })
    expect(validateEstateSection(answers, { household: householdFixture() }).status).toBe(
      'complete',
    )
  })

  it('warns about guardianship with minor dependents and not without', () => {
    const withMinor = answersFixture((a) => {
      a.overview.dependentsCount = 1
      a.estate.itemsAcknowledged = true
      a.estate.legacyGoals = 'Care for kids'
      for (const item of a.estate.items) {
        if (
          item.key === 'will' ||
          item.key === 'financial_poa' ||
          item.key === 'healthcare_poa' ||
          item.key === 'advance_directive' ||
          item.key === 'beneficiary_review' ||
          item.key === 'guardianship_plan'
        ) {
          item.status = item.key === 'guardianship_plan' ? 'not_in_place' : 'in_place'
        } else {
          item.status = 'not_applicable'
        }
      }
    })
    const householdWithChild = householdFixture({
      members: [
        memberFixture({ id: 'm1' }),
        memberFixture({
          id: 'm2',
          first_name: 'Kid',
          relationship: 'child',
          is_primary_contact: false,
          date_of_birth: '2015-01-01',
        }),
      ],
    })
    const warned = validateEstateSection(withMinor, { household: householdWithChild })
    expect(warned.warnings.guardianship).toBeTruthy()
    expect(warned.status).not.toBe('needs_attention')

    const noDependents = answersFixture((a) => {
      a.estate.itemsAcknowledged = true
      a.estate.legacyGoals = 'Simple plan'
      for (const item of a.estate.items) {
        if (
          item.key === 'will' ||
          item.key === 'financial_poa' ||
          item.key === 'healthcare_poa' ||
          item.key === 'advance_directive' ||
          item.key === 'beneficiary_review'
        ) {
          item.status = 'unknown'
        } else {
          item.status = 'not_applicable'
        }
      }
    })
    const noWarn = validateEstateSection(noDependents, {
      household: householdFixture({ members: [memberFixture({ id: 'm1', date_of_birth: '1980-01-01' })] }),
    })
    expect(noWarn.warnings.guardianship).toBeUndefined()
  })

  it('warns for business succession relevance and rejects invalid review date', () => {
    const answers = answersFixture((a) => {
      a.assets.items = [emptyAssetItem({ id: 'b1', category: 'business_ownership', balanceCents: 1 })]
      a.estate.itemsAcknowledged = true
      a.estate.legacyGoals = 'Continuity'
      a.estate.lastReviewDate = '2026-13-40'
      for (const item of a.estate.items) {
        if (
          item.key === 'will' ||
          item.key === 'financial_poa' ||
          item.key === 'healthcare_poa' ||
          item.key === 'advance_directive' ||
          item.key === 'beneficiary_review' ||
          item.key === 'business_succession'
        ) {
          item.status = 'needs_review'
        } else {
          item.status = 'not_applicable'
        }
      }
    })
    const result = validateEstateSection(answers, { household: householdFixture() })
    expect(result.warnings.businessSuccession).toBeTruthy()
    expect(hasBusinessOwnershipAsset(answers)).toBe(true)
    // Invalid date is normalized away by schema; set after normalize for direct validation
    answers.estate.lastReviewDate = 'not-a-date'
    expect(validateEstateSection(answers, { household: householdFixture() }).status).toBe(
      'needs_attention',
    )
  })

  it('keeps legal disclosure text available for UI', () => {
    expect(ESTATE_LEGAL_DISCLOSURE).toMatch(/not legal advice/i)
  })
})

describe('goals validation', () => {
  it('supports multiple priorities with unique ranks and source distinction', () => {
    const answers = answersFixture((a) => {
      a.goals.priorities = [
        emptyPriorityItem({
          id: 'p1',
          rank: 1,
          title: 'Build emergency fund',
          source: 'client_stated',
          timeHorizon: '12_months',
          targetAmountCents: null,
        }),
        emptyPriorityItem({
          id: 'p2',
          rank: 2,
          title: 'Review protection',
          source: 'advisor_observed',
          timeHorizon: '90_days',
          targetAmountCents: 0,
        }),
      ]
      a.goals.primaryMotivation = 'Stability'
    })
    expect(validateGoalsSection(answers).status).toBe('complete')
  })

  it('rejects duplicate ranks and negative targets', () => {
    const dup = answersFixture((a) => {
      a.goals.priorities = [
        emptyPriorityItem({ id: 'p1', rank: 1, title: 'A', source: 'client_stated' }),
        emptyPriorityItem({ id: 'p2', rank: 1, title: 'B', source: 'client_stated' }),
      ]
      a.goals.primaryMotivation = 'x'
    })
    expect(validateGoalsSection(dup).status).toBe('needs_attention')

    const neg = answersFixture((a) => {
      a.goals.priorities = [
        emptyPriorityItem({
          id: 'p1',
          rank: 1,
          title: 'A',
          source: 'client_stated',
          targetAmountCents: -5 as never,
        }),
      ]
      a.goals.primaryMotivation = 'x'
    })
    expect(validateGoalsSection(neg).status).toBe('needs_attention')
  })

  it('completes with no-current-goals and validates target dates / stable ids', () => {
    const none = answersFixture((a) => {
      a.goals.noCurrentGoals = true
    })
    expect(validateGoalsSection(none).status).toBe('complete')

    const badDate = answersFixture((a) => {
      a.goals.priorities = [
        emptyPriorityItem({
          id: 'p1',
          rank: 1,
          title: 'Trip',
          source: 'client_stated',
          targetDate: 'bad',
        }),
      ]
      a.goals.primaryMotivation = 'Travel'
    })
    expect(validateGoalsSection(badDate).status).toBe('needs_attention')
    expect(isValidIsoDateOnly('2026-07-01')).toBe(true)
    expect(isValidIsoDateOnly('2026-99-01')).toBe(false)
  })

  it('requires at least one client-stated goal unless acknowledged none', () => {
    const answers = answersFixture((a) => {
      a.goals.immediateConcerns = [
        emptyImmediateConcern({
          id: 'c1',
          description: 'Advisor note only',
          source: 'advisor_observed',
        }),
      ]
      a.goals.priorities = [
        emptyPriorityItem({
          id: 'p1',
          rank: 1,
          title: 'Observed',
          source: 'advisor_observed',
        }),
      ]
      a.goals.primaryMotivation = 'Improve cash flow'
    })
    expect(validateGoalsSection(answers).missingRequiredFields).toContain(
      'clientStatedGoalOrNoGoals',
    )
  })
})

describe('phase 4 progress and cross-section helpers', () => {
  it('drives all ten form sections from validation and marks review complete when ready', () => {
    const answers = completeFormAnswersFixture()
    const household = householdFixture()
    const snapshot = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'goals',
      assessmentStatus: 'draft',
      household,
    })
    expect(snapshot.sectionStates.insurance).toBe('complete')
    expect(snapshot.sectionStates.retirement).toBe('complete')
    expect(snapshot.sectionStates.estate).toBe('complete')
    expect(snapshot.sectionStates.goals).toBe('complete')
    expect(snapshot.sectionStates.review).toBe('complete')
    expect(snapshot.completedSectionsCount).toBe(ONBOARDING_SECTION_IDS.length)
  })

  it('marks invalid Phase 4 data as needs_attention and completed assessments as 100%', () => {
    const answers = answersFixture((a) => {
      a.insurance.protectionConcernsAcknowledged = true
      a.insurance.coverages = [
        emptyInsuranceCoverage({
          id: 'c1',
          coverageType: 'life',
          premiumCents: -10 as never,
        }),
      ]
    })
    const household = householdFixture()
    expect(
      validateOnboardingSection('insurance', answers, { household }).status,
    ).toBe('needs_attention')
    const completed = buildOnboardingProgressSnapshot({
      answers,
      currentSectionId: 'review',
      assessmentStatus: 'completed',
      household,
    })
    expect(completed.progressPercent).toBe(100)
  })

  it('detects minor dependents and business ownership for educational warnings', () => {
    const household = householdFixture({
      members: [
        memberFixture({ id: 'm1' }),
        memberFixture({
          id: 'm2',
          relationship: 'child',
          is_primary_contact: false,
          date_of_birth: '2018-05-01',
        }),
      ],
    })
    expect(hasMinorHouseholdMembers(household)).toBe(true)
    const answers = answersFixture((a) => {
      a.overview.dependentsCount = 1
      a.assets.items = [emptyAssetItem({ id: 'b1', category: 'business_ownership' })]
    })
    expect(householdHasIncomeDependentsContext(answers, household)).toBe(true)
    expect(hasBusinessOwnershipAsset(answers)).toBe(true)
  })
})
