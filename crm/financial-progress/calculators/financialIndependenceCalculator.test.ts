import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { financialIndependenceCalculator } from './financialIndependenceCalculator'
import {
  FI_PROGRESS_MET_RATIO,
  FI_PROGRESS_PARTIAL_RATIO,
  FI_TARGET_CONFLICT_TOLERANCE_PERCENT,
  FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS,
  FI_PLAN_REVIEW_CURRENT_MONTHS,
} from './financialIndependence/constants'
import {
  extractFinancialIndependenceSignals,
  parseDecimalWithdrawalRate,
  parseGenericWithdrawalRate,
  parsePercentWithdrawalRate,
} from './financialIndependence/extractSignals'
import {
  buildFinancialIndependenceRecommendations,
  scoreAllFinancialIndependenceCriteria,
  scoreFiFundingStrategyTracking,
  scoreFiGoalDefinition,
  scoreFiProgressTowardTarget,
  scoreFiTarget,
  summarizeFinancialIndependenceScore,
  toFinancialIndependenceEvidence,
} from './financialIndependence/scoreCriteria'

const AS_OF = '2026-07-26T12:00:00.000Z'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-fi-1',
    display_name: 'FI Household',
    status: 'client',
    primary_email: null,
    primary_phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    assigned_advisor_id: null,
    relationship_stage_id: 'stage-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    assigned_advisor: null,
    relationship_stage: null,
    members: [],
    ...overrides,
  }
}

function makeFamilyAssessment(
  answers: Record<string, unknown>,
  derived_metrics: Record<string, unknown> | null = null,
): HouseholdAssessmentSummary {
  return {
    id: 'assess-family',
    assessment_type: 'family',
    capture_channel: 'unknown',
    overall_score: 70,
    overall_grade: 'C',
    completed_at: '2026-06-01T00:00:00.000Z',
    answers,
    derived_metrics,
  }
}

function makeRetirementAssessment(
  answers: Record<string, unknown>,
  derived_metrics: Record<string, unknown> | null = null,
): HouseholdAssessmentSummary {
  return {
    id: 'assess-retirement',
    assessment_type: 'retirement',
    capture_channel: 'unknown',
    overall_score: 70,
    overall_grade: 'C',
    completed_at: '2026-06-01T00:00:00.000Z',
    answers,
    derived_metrics,
  }
}

function makeInput(
  overrides: Partial<HouseholdFinancialProgressInput> = {},
): HouseholdFinancialProgressInput {
  return {
    household: makeHousehold(),
    asOf: AS_OF,
    ...overrides,
  }
}

function scoreGoal(input: HouseholdFinancialProgressInput) {
  return scoreFiGoalDefinition(extractFinancialIndependenceSignals(input))
}

function scoreTarget(input: HouseholdFinancialProgressInput) {
  return scoreFiTarget(extractFinancialIndependenceSignals(input))
}

function scoreProgress(input: HouseholdFinancialProgressInput) {
  return scoreFiProgressTowardTarget(extractFinancialIndependenceSignals(input))
}

function scoreStrategy(input: HouseholdFinancialProgressInput) {
  return scoreFiFundingStrategyTracking(extractFinancialIndependenceSignals(input))
}

describe('financial independence constants', () => {
  it('documents budgets, thresholds, and engine version 1.0.0', () => {
    expect(FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_goal_definition).toBe(1)
    expect(FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_target).toBe(1)
    expect(FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_progress_toward_target).toBe(2)
    expect(FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_funding_strategy_tracking).toBe(1)
    expect(FI_PROGRESS_MET_RATIO).toBe(0.75)
    expect(FI_PROGRESS_PARTIAL_RATIO).toBe(0.25)
    expect(FI_TARGET_CONFLICT_TOLERANCE_PERCENT).toBe(10)
    expect(FI_PLAN_REVIEW_CURRENT_MONTHS).toBe(12)
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('1.0.0')
  })
})

describe('FI Goal Definition', () => {
  it('scores defined goals and rejects vague or unrelated signals', () => {
    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceGoalDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { workOptionalGoalDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { passiveIncomeObjectiveDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { desiredAnnualLifestyleIncome: 80000 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { targetRetirementAge: 60, retirementAgeTiedToFi: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { targetRetirementAge: '65' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceGoal: 'save more' }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { hasFinancialIndependenceGoal: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(scoreGoal(makeInput()).status).toBe('incomplete')

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceGoalDocumented: 'yes',
                hasFinancialIndependenceGoal: 'no',
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGoal(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              { savings: { monthlyContribution: '1000' } },
              { retirementContributionRate: 0.15 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGoal(
        makeInput({
          openTasks: [
            {
              id: 't1',
              title: 'Think about retirement',
              due_date: null,
              priority: 'low',
              status: 'open',
            },
          ],
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('FI withdrawal-rate unit handling', () => {
  it('normalizes decimal, percent, and percent-string rates without magnitude guessing', () => {
    expect(parseDecimalWithdrawalRate(0.04)).toEqual({ status: 'ok', rate: 0.04 })
    expect(parseDecimalWithdrawalRate('0.04')).toEqual({ status: 'ok', rate: 0.04 })
    expect(parseDecimalWithdrawalRate(4)).toEqual({ status: 'invalid' })

    expect(parsePercentWithdrawalRate(4)).toEqual({ status: 'ok', rate: 0.04 })
    expect(parsePercentWithdrawalRate('4%')).toEqual({ status: 'ok', rate: 0.04 })
    expect(parsePercentWithdrawalRate(150)).toEqual({ status: 'invalid' })

    expect(parseGenericWithdrawalRate(0.04)).toEqual({ status: 'ok', rate: 0.04 })
    expect(parseGenericWithdrawalRate('0.04')).toEqual({ status: 'ok', rate: 0.04 })
    expect(parseGenericWithdrawalRate('4%')).toEqual({ status: 'ok', rate: 0.04 })
    expect(parseGenericWithdrawalRate(4)).toEqual({ status: 'ambiguous' })
    expect(parseGenericWithdrawalRate('4')).toEqual({ status: 'ambiguous' })
    expect(parseGenericWithdrawalRate(0)).toEqual({ status: 'invalid' })
    expect(parseGenericWithdrawalRate(-0.04)).toEqual({ status: 'invalid' })
    expect(parseGenericWithdrawalRate('abc')).toEqual({ status: 'invalid' })
  })

  it('derives targets only from unit-safe rates and isolates conflicts', () => {
    const derivedDecimal = scoreTarget(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { desiredAnnualFiIncome: 80000, fiWithdrawalRateDecimal: 0.04 },
          ),
        },
      }),
    )
    expect(derivedDecimal).toMatchObject({ points: 1, status: 'met' })
    expect(derivedDecimal.explanation).toMatch(
      /explicitly provided annual income objective and withdrawal-rate assumption/i,
    )
    expect(derivedDecimal.explanation).not.toMatch(
      /safe withdrawal|recommended withdrawal|sustainable withdrawal/i,
    )

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRatePercent: 4 },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRate: '4%' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRate: '0.04' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Equivalent decimal + percent dedupe
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                desiredAnnualFiIncome: 80000,
                fiWithdrawalRateDecimal: 0.04,
                fiWithdrawalRatePercent: 4,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Conflicting 4% vs 5%
    const rateConflict = scoreTarget(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              desiredAnnualFiIncome: 80000,
              fiWithdrawalRateDecimal: 0.04,
              fiWithdrawalRatePercent: 5,
            },
          ),
        },
      }),
    )
    expect(rateConflict.status).toBe('incomplete')

    // Ambiguous unlabeled 4
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRate: 4 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRate: 0 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRatePercent: -4 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRatePercent: 150 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRate: 'not-a-rate' },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Ambiguous generic ignored when authoritative decimal exists
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                desiredAnnualFiIncome: 80000,
                fiWithdrawalRateDecimal: 0.04,
                fiWithdrawalRate: 4,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Monthly income with authoritative monthly field semantics
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                desiredMonthlyFiIncome: 8000,
                fiWithdrawalRateDecimal: 0.04,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Rate conflict leaves progress incomplete; goal/strategy continue
    const isolated = financialIndependenceCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              financialIndependenceGoalDocumented: 'yes',
              desiredAnnualFiIncome: 80000,
              fiWithdrawalRateDecimal: 0.04,
              fiWithdrawalRatePercent: 5,
              fiEligibleAssets: 500000,
              fiFundingStrategyDocumented: 'yes',
            },
          ),
        },
      }),
    )
    const byCriterion = Object.fromEntries(
      (isolated.progress.evidence ?? []).map((item) => [item.criterion, item]),
    )
    expect(byCriterion['Financial Independence Target']?.status).toBe('incomplete')
    expect(byCriterion['Progress Toward Target']?.status).toBe('incomplete')
    expect(byCriterion['Financial Independence Goal Definition']?.earnedPoints).toBe(1)
    expect(byCriterion['Funding Strategy & Progress Tracking']?.earnedPoints).toBe(1)
  })
})

describe('FI Target', () => {
  it('scores explicit/derived targets without silent 4% or 25× defaults', () => {
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceTarget: 1500000 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { retirementAssetTarget: 1200000 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { desiredAnnualFiIncome: 80000, fiWithdrawalRateDecimal: 0.04 },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { desiredAnnualFiIncome: 80000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { fiWithdrawalRateDecimal: 0.04 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceTarget: 0 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceTarget: -100 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                fiTarget: 1500000,
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Within tolerance
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                desiredAnnualFiIncome: 40000,
                fiWithdrawalRateDecimal: 0.04, // derived 1,000,000
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Outside tolerance
    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                desiredAnnualFiIncome: 80000,
                fiWithdrawalRateDecimal: 0.04, // derived 2,000,000
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreTarget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { hasFinancialIndependenceTarget: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(scoreTarget(makeInput()).status).toBe('incomplete')
  })
})

describe('FI Progress Toward Target', () => {
  it('scores age-neutral progress bands and asset inclusion rules', () => {
    const withRatio = (assets: number, target = 1000000) =>
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: target,
                fiEligibleAssets: assets,
              },
            ),
          },
        }),
      )

    expect(withRatio(0)).toMatchObject({ points: 0, status: 'unmet' })
    expect(withRatio(249999)).toMatchObject({ points: 0, status: 'unmet' })
    expect(withRatio(250000)).toMatchObject({ points: 1, status: 'partial' })
    expect(withRatio(500000)).toMatchObject({ points: 1, status: 'partial' })
    expect(withRatio(749999)).toMatchObject({ points: 1, status: 'partial' })
    expect(withRatio(750000)).toMatchObject({ points: 2, status: 'met' })
    expect(withRatio(1200000)).toMatchObject({ points: 2, status: 'met' })
    expect(withRatio(1200000).explanation).toMatch(/approximately/i)
    expect(withRatio(1200000).explanation).not.toMatch(/behind|on track|guaranteed/i)

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { financialIndependenceTarget: 1000000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { fiEligibleAssets: 500000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Emergency / home equity excluded by default
    const excluded = scoreProgress(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              financialIndependenceTarget: 1000000,
              totalRetirementAssets: 200000,
              emergencyFundBalance: 50000,
              homeEquity: 400000,
            },
          ),
        },
      }),
    )
    expect(excluded.points).toBe(0) // 20%
    expect(excluded.explanation).toMatch(/20%/)

    const designatedHome = scoreProgress(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              financialIndependenceTarget: 1000000,
              totalRetirementAssets: 500000,
              designatedHomeEquityForFi: 250000,
            },
          ),
        },
      }),
    )
    expect(designatedHome.points).toBe(2)
    expect(designatedHome.explanation).toMatch(/home-equity/i)

    // Dedup aggregate vs account sum
    expect(
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                totalRetirementAssets: 800000,
                sumOfRetirementAccountBalances: 800000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                totalRetirementAssets: 800000,
                sumOfRetirementAccountBalances: 400000,
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                financialIndependenceTarget: 1000000,
                fiEligibleAssets: -1,
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('FI Funding Strategy & Tracking', () => {
  it('requires FI-tied strategy and current review evidence', () => {
    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { fiFundingStrategyDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { fiPlanReviewDate: '2026-01-26T00:00:00.000Z' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Exact 12-month boundary
    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { fiPlanReviewDate: '2025-07-26T00:00:00.000Z' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { fiPlanReviewDate: '2025-06-26T00:00:00.000Z' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { advisorFiDiscussion: 'yes' }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { hasRetirementPlan: 'yes' }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              { hasRetirementPlan: 'yes', retirementPlanTiedToFi: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreStrategy(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { hasFiFundingStrategy: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(scoreStrategy(makeInput()).status).toBe('incomplete')
  })
})

describe('financialIndependenceCalculator category behavior', () => {
  it('returns insufficient_data when all criteria incomplete', () => {
    expect(financialIndependenceCalculator.calculate(makeInput()).progress.status).toBe(
      'insufficient_data',
    )
  })

  it('computes from one criterion and never exceeds 5', () => {
    const one = financialIndependenceCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({}, { financialIndependenceGoalDocumented: 'yes' }),
        },
      }),
    )
    expect(one.progress.status).toBe('computed')
    expect(one.progress.score).toBe(1)
    expect(
      (one.progress.evidence ?? []).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(one.progress.score)
    expect(one.progress.summary).toMatch(/not a guaranteed independence outcome/i)
    expect(one.progress.summary).not.toMatch(/safe withdrawal|will become financially independent/i)
  })

  it('scores a full 5-point path with educational recommendations deduped', () => {
    const full = financialIndependenceCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              financialIndependenceGoalDocumented: 'yes',
              financialIndependenceTarget: 1000000,
              fiEligibleAssets: 800000,
              fiFundingStrategyDocumented: 'yes',
            },
          ),
        },
      }),
    )
    expect(full.progress.status).toBe('computed')
    expect(full.progress.score).toBe(5)
    expect(full.progress.evidence).toHaveLength(4)
    expect(full.recommendations).toHaveLength(0)

    const signals = extractFinancialIndependenceSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({}, { hasFinancialIndependenceGoal: 'no' }),
        },
      }),
    )
    const outcomes = scoreAllFinancialIndependenceCriteria(signals)
    const recommendations = buildFinancialIndependenceRecommendations(outcomes, signals)
    const keys = recommendations.map((item) => item.actionKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(
      recommendations.every(
        (item) => !/annuity|IUL|brokerage platform|guaranteed-income|home equity/i.test(item.body),
      ),
    ).toBe(true)
    expect(
      toFinancialIndependenceEvidence(outcomes).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(summarizeFinancialIndependenceScore(outcomes).score)
  })

  it('keeps conflicts isolated across criteria', () => {
    const result = financialIndependenceCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              financialIndependenceGoalDocumented: 'yes',
              financialIndependenceTarget: 1000000,
              fiTarget: 2000000,
              fiEligibleAssets: 500000,
              fiFundingStrategyDocumented: 'yes',
            },
          ),
        },
      }),
    )
    const byCriterion = Object.fromEntries(
      (result.progress.evidence ?? []).map((item) => [item.criterion, item]),
    )
    expect(byCriterion['Financial Independence Target']?.status).toBe('incomplete')
    expect(byCriterion['Financial Independence Goal Definition']?.earnedPoints).toBe(1)
    expect(byCriterion['Funding Strategy & Progress Tracking']?.earnedPoints).toBe(1)
    expect(byCriterion['Progress Toward Target']?.status).toBe('incomplete')
  })

  it('does not infer FI from income, net worth, home ownership, or emergency savings', () => {
    const result = financialIndependenceCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: {
              householdIncome: '250000',
              netWorth: '2000000',
              homeOwnership: 'own',
              emergencyFundMonths: '12',
            },
          }),
        },
      }),
    )
    expect(result.progress.status).toBe('insufficient_data')
  })
})
