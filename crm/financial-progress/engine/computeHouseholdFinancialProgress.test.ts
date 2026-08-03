import { describe, expect, it } from 'vitest'
import type { CrmHouseholdDetail } from '../../households/types'
import {
  DEFAULT_CATEGORY_CALCULATORS,
  createPlaceholderCalculator,
} from '../calculators'
import {
  FINANCIAL_PROGRESS_CATEGORIES,
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS,
  FINANCIAL_PROGRESS_ENGINE_VERSION,
  FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  getCategoryDefinition,
} from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { buildOverallGrade } from './buildOverallGrade'
import { composeCategoryScores } from './composeCategoryScores'
import { computeHouseholdFinancialProgress } from './computeHouseholdFinancialProgress'
import { gradeFromProgressScore } from './gradeFromProgressScore'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-progress-1',
    display_name: 'Progress Household',
    status: 'client',
    primary_email: 'client@example.com',
    primary_phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    assigned_advisor_id: null,
    relationship_stage_id: 'stage-1',
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z',
    assigned_advisor: null,
    relationship_stage: null,
    members: [],
    ...overrides,
  }
}

function makeInput(
  overrides: Partial<HouseholdFinancialProgressInput> = {},
): HouseholdFinancialProgressInput {
  return {
    household: makeHousehold(),
    asOf: '2026-07-25T15:00:00.000Z',
    ...overrides,
  }
}

describe('computeHouseholdFinancialProgress', () => {
  it('returns structured progress with Protection scored and overall withheld', () => {
    const result = computeHouseholdFinancialProgress(makeInput({ policies: undefined }))

    expect(result.householdId).toBe('hh-progress-1')
    expect(result.engineVersion).toBe(FINANCIAL_PROGRESS_ENGINE_VERSION)
    expect(result.methodologyVersion).toBe(FINANCIAL_PROGRESS_METHODOLOGY_VERSION)
    expect(result.isPlaceholder).toBe(false)
    expect(result.totalCategoryCount).toBe(8)
    expect(result.completedCategoryCount).toBe(0)
    expect(result.totalAvailablePoints).toBe(100)
    expect(result.completedAvailablePoints).toBe(0)
    expect(result.overall.status).toBe('insufficient_data')
    expect(result.overall.score).toBeNull()
    expect(result.overall.grade).toBeNull()
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.snapshot.completedCategoryCount).toBe(0)
    expect(result.snapshot.computedAt).toBe('2026-07-25T15:00:00.000Z')
  })

  it('composes Category Progress for all eight approved categories with maxPoints', () => {
    const result = computeHouseholdFinancialProgress(makeInput({ policies: undefined }))
    const categoryIds = result.categories.map((category) => category.categoryId)

    expect(categoryIds).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(result.categories).toHaveLength(8)

    for (const category of result.categories) {
      const definition = getCategoryDefinition(category.categoryId)
      expect(category.maxPoints).toBe(definition.maxPoints)
      expect(category.maxPoints).toBe(FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS[category.categoryId])
      expect(category.weight).toBe(definition.weight)
      expect(category.weight).toBe(category.maxPoints / 100)

      expect(category.status).toBe('insufficient_data')
      expect(category.score).toBeNull()
    }
  })

  it('allows custom composable calculators while withholding overall until all are complete', () => {
    const custom: CategoryCalculator = {
      categoryId: 'debt_management',
      calculate: (): CategoryCalculation => {
        const definition = getCategoryDefinition('debt_management')
        return {
          progress: {
            categoryId: 'debt_management',
            score: 16,
            maxPoints: definition.maxPoints,
            weight: definition.weight,
            grade: null,
            status: 'computed',
            summary: 'Custom debt Category Progress',
          },
          recommendations: [],
        }
      },
    }

    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      categoryId === 'debt_management' ? custom : createPlaceholderCalculator(categoryId),
    )

    const result = computeHouseholdFinancialProgress(makeInput(), { calculators })
    const debt = result.categories.find((category) => category.categoryId === 'debt_management')

    expect(debt?.status).toBe('computed')
    expect(debt?.score).toBe(16)
    expect(debt?.maxPoints).toBe(20)
    expect(result.isPlaceholder).toBe(false)
    expect(result.completedCategoryCount).toBe(1)
    expect(result.completedAvailablePoints).toBe(20)
    expect(result.overall.status).toBe('partial')
    expect(result.overall.score).toBeNull()
    expect(result.overall.grade).toBeNull()
  })

  it('rejects input without a household id', () => {
    expect(() =>
      computeHouseholdFinancialProgress({
        household: makeHousehold({ id: '' }),
      }),
    ).toThrow(/valid id/)
  })

  it('rejects calculator sets that omit a required category', () => {
    expect(() =>
      computeHouseholdFinancialProgress(makeInput(), {
        calculators: [createPlaceholderCalculator('cash_flow_budget')],
      }),
    ).toThrow(/missing calculator for category/)
  })

  it('surfaces all eight real categories and publishes overall score when complete', () => {
    const fullInput = makeInput({
      policies: [
        {
          id: 'p1',
          carrier: 'Acme',
          policy_type: 'Term Life',
          status: 'active',
          coverage_amount: 250000,
          renewal_or_review_date: null,
          beneficiary: null,
        },
      ],
      assessments: {
        family: {
          id: 'a1',
          assessment_type: 'family',
          capture_channel: 'unknown',
          overall_score: 60,
          overall_grade: 'D',
          completed_at: '2026-06-01T00:00:00.000Z',
          answers: {
            financial: {
              householdIncome: '120000',
              totalDebt: '25000',
              emergencyFundMonths: '6',
              monthlyCashFlow: 'save-most-months',
            },
            protection: {
              currentLifeInsurance: '250000',
              hasDisabilityProtection: 'no',
              beneficiariesReviewed: 'yes',
              hasWill: 'yes',
              hasTrust: 'yes',
              guardianDocumented: 'yes',
            },
          },
          derived_metrics: {
            protectionNeed: 500000,
            creditCardUtilization: 0.05,
            apr: 0.24,
            debtPayoffStrategy: 'avalanche',
            dedicatedEmergencyFund: 'yes',
            emergencyFundLiquidity: 'savings',
            automaticEmergencySavings: 'yes',
            monthlyIncome: 10000,
            monthlyExpenses: 7000,
            hasDocumentedBudget: 'yes',
            budgetingMethod: 'zero-based',
            budgetUse: 'active',
            savingsRate: 0.2,
            expenseTrackingFrequency: 'monthly',
            healthcareDirective: 'yes',
            estateInformationOrganized: 'yes',
            finalWishesDocumented: 'yes',
            hasMinorChildren: 'yes',
            currentOnPayments: 'yes',
            latePaymentCount: 0,
            oldestAccountAgeMonths: 120,
            recentInquiries12m: 0,
            newAccounts12m: 0,
            creditMonitoringEnabled: 'yes',
            financialIndependenceGoalDocumented: 'yes',
            financialIndependenceTarget: 1000000,
            fiEligibleAssets: 800000,
            fiFundingStrategyDocumented: 'yes',
          },
        },
        retirement: {
          id: 'a-ret',
          assessment_type: 'retirement',
          capture_channel: 'unknown',
          overall_score: 70,
          overall_grade: 'C',
          completed_at: '2026-06-01T00:00:00.000Z',
          answers: {
            household: { currentAge: '50', targetRetirementAge: '65' },
            lifestyle: { estimatedMonthlyRetirementSpending: '8000' },
            vision: { planClarity: 'very-clear' },
            savings: { employerMatch: 'full-match' },
            estate: {
              hasPowerOfAttorney: 'yes',
              legacyIntent: 'strong',
            },
          },
          derived_metrics: {
            retirementContributionRate: 0.15,
            retirementFundingRatio: 1,
          },
        },
      },
    })

    const result = computeHouseholdFinancialProgress(fullInput)

    const cashFlow = result.categories.find(
      (category) => category.categoryId === 'cash_flow_budget',
    )
    const protection = result.categories.find(
      (category) => category.categoryId === 'protection_insurance',
    )
    const debt = result.categories.find(
      (category) => category.categoryId === 'debt_management',
    )
    const emergency = result.categories.find(
      (category) => category.categoryId === 'emergency_fund',
    )
    const retirement = result.categories.find(
      (category) => category.categoryId === 'retirement_readiness',
    )
    const estate = result.categories.find(
      (category) => category.categoryId === 'estate_legacy',
    )
    const credit = result.categories.find(
      (category) => category.categoryId === 'credit_health',
    )
    const independence = result.categories.find(
      (category) => category.categoryId === 'financial_independence',
    )
    expect(cashFlow?.status).toBe('computed')
    expect(cashFlow?.score).toBe(15)
    expect(cashFlow?.evidence).toHaveLength(4)
    expect(protection?.status).toBe('computed')
    expect(protection?.score).toBeGreaterThanOrEqual(0)
    expect(debt?.status).toBe('computed')
    expect(debt?.score).toBeGreaterThanOrEqual(0)
    expect(debt?.evidence).toHaveLength(4)
    expect(emergency?.status).toBe('computed')
    expect(emergency?.score).toBe(10)
    expect(emergency?.evidence).toHaveLength(4)
    expect(retirement?.status).toBe('computed')
    expect(retirement?.score).toBe(15)
    expect(retirement?.evidence).toHaveLength(4)
    expect(estate?.status).toBe('computed')
    expect(estate?.score).toBe(10)
    expect(estate?.evidence).toHaveLength(4)
    expect(credit?.status).toBe('computed')
    expect(credit?.score).toBe(10)
    expect(credit?.evidence).toHaveLength(4)
    expect(independence?.status).toBe('computed')
    expect(independence?.score).toBe(5)
    expect(independence?.evidence).toHaveLength(4)
    expect(result.completedCategoryCount).toBe(8)
    expect(result.completedAvailablePoints).toBe(100)
    expect(result.totalCategoryCount).toBe(8)
    expect(result.totalAvailablePoints).toBe(100)
    expect(result.engineVersion).toBe('1.0.0')
    expect(result.methodologyVersion).toBe('household-progress-v1')
    expect(result.categories.every((category) => category.status !== 'placeholder')).toBe(true)

    const categorySum = result.categories.reduce(
      (sum, category) => sum + (category.score ?? 0),
      0,
    )
    expect(result.overall.status).toBe('computed')
    expect(result.overall.score).toBe(categorySum)
    expect(result.overall.score).toBeGreaterThanOrEqual(0)
    expect(result.overall.score).toBeLessThanOrEqual(100)
    expect(result.overall.grade).toBe(gradeFromProgressScore(categorySum))
    expect(result.recommendations.length).toBeGreaterThan(0)

    // Removing FI evidence returns overall publication to partial.
    const withoutFi = computeHouseholdFinancialProgress(
      makeInput({
        ...fullInput,
        assessments: {
          ...fullInput.assessments,
          family: {
            ...fullInput.assessments!.family!,
            derived_metrics: {
              ...(fullInput.assessments!.family!.derived_metrics as Record<string, unknown>),
              financialIndependenceGoalDocumented: undefined,
              financialIndependenceTarget: undefined,
              fiEligibleAssets: undefined,
              fiFundingStrategyDocumented: undefined,
            },
          },
        },
      }),
    )
    expect(
      withoutFi.categories.find((category) => category.categoryId === 'financial_independence')
        ?.status,
    ).toBe('insufficient_data')
    expect(withoutFi.completedCategoryCount).toBe(7)
    expect(withoutFi.completedAvailablePoints).toBe(95)
    expect(withoutFi.overall.status).toBe('partial')
    expect(withoutFi.overall.score).toBeNull()
    expect(withoutFi.overall.grade).toBeNull()
  })
})

describe('composeCategoryScores', () => {
  it('invokes calculators independently without shared mutable state', () => {
    const calls: string[] = []
    const calculators: CategoryCalculator[] = FINANCIAL_PROGRESS_CATEGORY_IDS.map(
      (categoryId) => ({
        categoryId,
        calculate: () => {
          calls.push(categoryId)
          const definition = getCategoryDefinition(categoryId)
          return {
            progress: {
              categoryId,
              score: null,
              maxPoints: definition.maxPoints,
              weight: definition.weight,
              grade: null,
              status: 'placeholder' as const,
              summary: categoryId,
            },
            recommendations: [],
          }
        },
      }),
    )

    const scores = composeCategoryScores(makeInput(), calculators)
    expect(calls).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(scores.map((score) => score.categoryId)).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
  })
})

describe('buildOverallGrade', () => {
  it('returns placeholder Progress Score when all categories are placeholders', () => {
    const categories = composeCategoryScores(
      makeInput(),
      FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) => createPlaceholderCalculator(categoryId)),
    )
    expect(buildOverallGrade(categories).status).toBe('placeholder')
    expect(buildOverallGrade(categories).grade).toBeNull()
  })
})

describe('DEFAULT_CATEGORY_CALCULATORS', () => {
  it('registers exactly one calculator per approved category', () => {
    const ids = DEFAULT_CATEGORY_CALCULATORS.map((calculator) => calculator.categoryId)
    expect(ids).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(new Set(ids).size).toBe(ids.length)
    expect(FINANCIAL_PROGRESS_CATEGORIES).toHaveLength(8)
  })
})
