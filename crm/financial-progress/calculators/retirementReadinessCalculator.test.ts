import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
  HouseholdOpenTaskSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { retirementReadinessCalculator } from './retirementReadinessCalculator'
import {
  RETIREMENT_CONTRIBUTION_RATE_BANDS,
  RETIREMENT_PROGRESS_RATIO_BANDS,
  RETIREMENT_SOURCE_CONFLICT_TOLERANCE,
} from './retirementReadiness/constants'
import {
  extractRetirementReadinessSignals,
  valuesMateriallyConflict,
} from './retirementReadiness/extractSignals'
import {
  buildRetirementReadinessRecommendations,
  scoreAllRetirementReadinessCriteria,
  scoreEmployerMatchUtilization,
  scoreRetirementContributionActivity,
  scoreRetirementPlanGoalDefinition,
  scoreRetirementSavingsProgress,
  summarizeRetirementReadinessScore,
  toRetirementReadinessEvidence,
} from './retirementReadiness/scoreCriteria'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-ret-1',
    display_name: 'Retirement Household',
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

function makeRetirementAssessment(
  answers: Record<string, unknown>,
  derived_metrics: Record<string, unknown> | null = null,
): HouseholdAssessmentSummary {
  return {
    id: 'assess-retirement',
    assessment_type: 'retirement',
    overall_score: 70,
    overall_grade: 'C',
    completed_at: '2026-06-01T00:00:00.000Z',
    answers,
    derived_metrics,
  }
}

function makeFamilyAssessment(
  answers: Record<string, unknown>,
  derived_metrics: Record<string, unknown> | null = null,
): HouseholdAssessmentSummary {
  return {
    id: 'assess-family',
    assessment_type: 'family',
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
    asOf: '2026-07-26T12:00:00.000Z',
    ...overrides,
  }
}

function scoreActivity(input: HouseholdFinancialProgressInput) {
  return scoreRetirementContributionActivity(extractRetirementReadinessSignals(input))
}

function scoreMatch(input: HouseholdFinancialProgressInput) {
  return scoreEmployerMatchUtilization(extractRetirementReadinessSignals(input))
}

function scoreProgress(input: HouseholdFinancialProgressInput) {
  return scoreRetirementSavingsProgress(extractRetirementReadinessSignals(input))
}

function scorePlan(input: HouseholdFinancialProgressInput) {
  return scoreRetirementPlanGoalDefinition(extractRetirementReadinessSignals(input))
}

describe('retirement readiness constants', () => {
  it('documents bands, tolerance, and engine version', () => {
    expect(RETIREMENT_CONTRIBUTION_RATE_BANDS[0]).toMatchObject({
      minRateInclusive: 0.15,
      points: 4,
    })
    expect(RETIREMENT_PROGRESS_RATIO_BANDS[0]).toMatchObject({
      minRatioInclusive: 1,
      points: 5,
    })
    expect(RETIREMENT_SOURCE_CONFLICT_TOLERANCE).toBe(0.1)
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('0.7.0')
    expect(valuesMateriallyConflict(100, 109)).toBe(false)
    expect(valuesMateriallyConflict(100, 112)).toBe(true)
  })
})

describe('Retirement Contribution Activity', () => {
  it('scores verified rate bands including edges', () => {
    const cases: Array<[number, number, string]> = [
      [0, 0, 'unmet'],
      [0.04, 1, 'partial'],
      [0.05, 2, 'partial'],
      [0.07, 2, 'partial'],
      [0.1, 3, 'partial'],
      [0.12, 3, 'partial'],
      [0.15, 4, 'met'],
      [0.2, 4, 'met'],
    ]
    for (const [rate, points, status] of cases) {
      expect(
        scoreActivity(
          makeInput({
            assessments: {
              retirement: makeRetirementAssessment({}, { retirementContributionRate: rate }),
            },
          }),
        ),
      ).toMatchObject({ points, status })
    }
  })

  it('calculates rate from contribution amount and income with annual conversion', () => {
    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { monthlyContribution: '1000' },
              lifestyle: { currentAnnualGrossIncome: '120000' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' }) // 1000/10000 = 10%

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                annualRetirementContribution: 18000,
                monthlyIncome: 10000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' }) // 1500/10000 = 15%
  })

  it('confirms activity without rate and treats coded bands as non-rate evidence', () => {
    expect(
      scoreActivity(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { retirementContribution: 'over-15' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { retirementContribution: 'not-saving' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('excludes employer match, balances, and rollovers from contribution activity', () => {
    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              { employerMatch: 500, savingsBalance: 80000, rolloverAmount: 25000 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('handles invalid and conflicting contribution evidence', () => {
    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              { monthlyRetirementContribution: 500, monthlyIncome: 0 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              { monthlyRetirementContribution: -100, monthlyIncome: 5000 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { retirementContributionRate: 1.5 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                retirementContributionRate: 0.2,
                monthlyRetirementContribution: 500,
                monthlyIncome: 10000,
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete') // 5% raw vs 20% derived

    expect(
      scoreActivity(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                retirementContributionRate: 150,
                monthlyRetirementContribution: 1500,
                monthlyIncome: 10000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' }) // invalid derived, valid raw 15%
  })
})

describe('Employer Match Utilization', () => {
  it('scores full, partial, unused, unknown, and not applicable', () => {
    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'full-match' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'partial-match' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'not-participating' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'unsure' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'no-match-offered' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'not_applicable' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { employerMatch: 'self-employed' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'not_applicable' })
  })

  it('compares employee rate to match threshold without adding employer dollars', () => {
    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                employeeRetirementContributionRate: 0.06,
                employerMatchThreshold: 0.05,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                employeeRetirementContributionRate: 0.03,
                employerMatchThreshold: 0.05,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                employeeRetirementContributionRate: 0,
                employerMatchThreshold: 0.05,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('aggregates multi-member match opportunities', () => {
    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                memberRetirementMatches: [
                  { memberId: 'a', employerMatch: 'full-match' },
                  { memberId: 'b', employerMatch: 'full-match' },
                ],
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                memberRetirementMatches: [
                  { memberId: 'a', employerMatch: 'full-match' },
                  { memberId: 'b', employerMatch: 'partial-match' },
                ],
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                memberRetirementMatches: [
                  { memberId: 'a', employerMatch: 'full-match' },
                  { memberId: 'b', employerMatch: 'not-participating' },
                ],
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreMatch(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                memberRetirementMatches: [
                  { memberId: 'a', employerMatch: 'full-match' },
                  { memberId: 'b', employerMatch: 'no-match-offered' },
                ],
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })
  })

  it('does not generate a recommendation for not_applicable match', () => {
    const signals = extractRetirementReadinessSignals(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment({
            savings: { employerMatch: 'no-match-offered' },
          }),
        },
      }),
    )
    const outcomes = scoreAllRetirementReadinessCriteria(signals)
    const recommendations = buildRetirementReadinessRecommendations(outcomes, signals)
    expect(recommendations.every((item) => !item.actionKey.includes('match'))).toBe(true)
  })
})

describe('Retirement Savings Progress', () => {
  it('scores funding ratio bands including edges', () => {
    const cases: Array<[number, number, string]> = [
      [1.1, 5, 'met'],
      [1, 5, 'met'],
      [0.8, 4, 'partial'],
      [0.75, 4, 'partial'],
      [0.6, 3, 'partial'],
      [0.5, 3, 'partial'],
      [0.3, 2, 'partial'],
      [0.25, 2, 'partial'],
      [0.1, 1, 'partial'],
      [0, 0, 'unmet'],
    ]
    for (const [ratio, points, status] of cases) {
      expect(
        scoreProgress(
          makeInput({
            assessments: {
              retirement: makeRetirementAssessment({}, { retirementFundingRatio: ratio }),
            },
          }),
        ),
      ).toMatchObject({ points, status })
    }
  })

  it('uses assets/target and income/goal paths', () => {
    expect(
      scoreProgress(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                currentRetirementSavings: 750000,
                retirementAssetTarget: 1000000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'partial' })

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                projectedRetirementIncome: 6000,
                retirementIncomeGoal: 8000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'partial' }) // 75%
  })

  it('does not score balances alone or excluded asset types', () => {
    expect(
      scoreProgress(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              savings: { currentRetirementSavings: '200000' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    expect(
      scoreProgress(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                homeEquity: 400000,
                emergencySavings: 20000,
                insuranceDeathBenefit: 500000,
                retirementAssetTarget: 1000000,
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('detects asset sum conflicts and derived/raw conflicts', () => {
    expect(
      scoreProgress(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {},
              {
                totalRetirementAssets: 500000,
                sumOfRetirementAccountBalances: 200000,
                retirementAssetTarget: 1000000,
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
            retirement: makeRetirementAssessment(
              {},
              {
                retirementFundingRatio: 0.9,
                currentRetirementSavings: 500000,
                retirementAssetTarget: 1000000,
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
            retirement: makeRetirementAssessment(
              {},
              {
                retirementFundingRatio: Number.NaN,
                currentRetirementSavings: 1000000,
                retirementAssetTarget: 1000000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 5, status: 'met' })
  })
})

describe('Retirement Plan & Goal Definition', () => {
  it('scores one point per documented element', () => {
    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { currentAge: '55', targetRetirementAge: '65' },
              lifestyle: { estimatedMonthlyRetirementSpending: '7000' },
              vision: { planClarity: 'very-clear' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { currentAge: '55', targetRetirementAge: '65' },
              lifestyle: { estimatedMonthlyRetirementSpending: '7000' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { currentAge: '55', targetRetirementAge: '65' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })
  })

  it('requires explicit strategy evidence; somewhat-clear alone does not count', () => {
    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              vision: { planClarity: 'somewhat-clear' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { currentAge: '55', targetRetirementAge: '65' },
              lifestyle: { estimatedMonthlyRetirementSpending: '7000' },
              vision: { planClarity: 'somewhat-clear' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              {
                household: { currentAge: '55', targetRetirementAge: '65' },
                lifestyle: { estimatedMonthlyRetirementSpending: '7000' },
                vision: { planClarity: 'somewhat-clear' },
              },
              { hasRetirementPlan: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { completedRetirementAnalysis: true }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              vision: { planClarity: 'very-clear' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              tax: { accountTypes: ['traditional'] },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scorePlan(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { retirementContribution: 'over-15' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    const task: HouseholdOpenTaskSummary = {
      id: 't1',
      title: 'Talk about retirement',
      due_date: null,
      priority: 'medium',
      status: 'open',
    }
    expect(scorePlan(makeInput({ openTasks: [task] })).status).toBe('incomplete')

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              vision: { primaryMotivation: 'reduce-stress', retirementLifestyle: 'comfortable' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('rejects invalid age, invalid goal, and explicit no-plan', () => {
    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              household: { currentAge: '55', targetRetirementAge: '50' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              lifestyle: { estimatedMonthlyRetirementSpending: '0' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scorePlan(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              vision: { planClarity: 'no-plan' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })
})

describe('Retirement Readiness category behavior', () => {
  it('returns insufficient_data when all criteria incomplete', () => {
    const result = retirementReadinessCalculator.calculate(makeInput())
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
  })

  it('does not unlock computed status from Employer Match not_applicable alone', () => {
    const result = retirementReadinessCalculator.calculate(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment({
            savings: { employerMatch: 'no-match-offered' },
          }),
        },
      }),
    )
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
    const matchEvidence = result.progress.evidence?.find(
      (item) => item.criterion === 'Employer Match Utilization',
    )
    expect(matchEvidence).toMatchObject({ status: 'not_applicable', earnedPoints: 0 })
    expect(result.recommendations.every((item) => !item.actionKey.includes('match'))).toBe(true)
  })

  it('computes when N/A is paired with a scorable partial or unmet criterion', () => {
    const partialResult = retirementReadinessCalculator.calculate(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment({
            savings: { employerMatch: 'no-match-offered' },
          }),
          family: makeFamilyAssessment({
            financial: { retirementContribution: 'over-15' },
          }),
        },
      }),
    )
    expect(partialResult.progress.status).toBe('computed')
    expect(partialResult.progress.score).toBe(1)
    expect(
      (partialResult.progress.evidence ?? []).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(1)

    const unmetResult = retirementReadinessCalculator.calculate(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment({
            savings: {
              employerMatch: 'no-match-offered',
              contributionConsistency: 'not-saving',
            },
          }),
        },
      }),
    )
    expect(unmetResult.progress.status).toBe('computed')
    expect(unmetResult.progress.score).toBe(0)
  })

  it('stays insufficient_data when only incomplete and not_applicable evidence exists', () => {
    const result = retirementReadinessCalculator.calculate(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment(
            { savings: { employerMatch: 'self-employed' } },
            { currentRetirementSavings: 50000 }, // assets without target → incomplete progress
          ),
        },
      }),
    )
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
  })

  it('can reach 15 points and keeps evidence totals aligned', () => {
    const result = retirementReadinessCalculator.calculate(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment(
            {
              household: { currentAge: '50', targetRetirementAge: '65' },
              lifestyle: { estimatedMonthlyRetirementSpending: '8000' },
              vision: { planClarity: 'very-clear' },
              savings: { employerMatch: 'full-match' },
            },
            {
              retirementContributionRate: 0.15,
              retirementFundingRatio: 1,
            },
          ),
        },
      }),
    )
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(15)
    const evidence = result.progress.evidence ?? []
    expect(evidence.reduce((sum, item) => sum + item.earnedPoints, 0)).toBe(15)
    expect(result.recommendations).toHaveLength(0)
  })

  it('keeps unrelated criteria scorable when one criterion conflicts', () => {
    const signals = extractRetirementReadinessSignals(
      makeInput({
        assessments: {
          retirement: makeRetirementAssessment(
            {
              savings: { employerMatch: 'full-match' },
              household: { currentAge: '55', targetRetirementAge: '67' },
            },
            {
              retirementContributionRate: 0.2,
              monthlyRetirementContribution: 100,
              monthlyIncome: 10000, // conflicts with 20% rate
            },
          ),
        },
      }),
    )
    const outcomes = scoreAllRetirementReadinessCriteria(signals)
    const byId = Object.fromEntries(outcomes.map((item) => [item.id, item]))
    expect(byId.retirement_contribution_activity.status).toBe('incomplete')
    expect(byId.employer_match_utilization.status).toBe('met')
    expect(byId.retirement_plan_goal_definition.points).toBe(1)
    const summarized = summarizeRetirementReadinessScore(outcomes)
    expect(summarized.status).toBe('computed')
    expect(
      toRetirementReadinessEvidence(outcomes).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(summarized.score)
  })
})
