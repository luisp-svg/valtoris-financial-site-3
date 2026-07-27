import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { emergencyFundCalculator } from './emergencyFundCalculator'
import {
  EMERGENCY_FUND_MONTHS_BANDS,
  EMERGENCY_FUND_TARGET_MONTHS,
} from './emergencyFund/constants'
import { extractEmergencyFundSignals } from './emergencyFund/extractSignals'
import {
  scoreAutomaticSavingsHabit,
  scoreDedicatedEmergencyFund,
  scoreEmergencyFundMonths,
  scoreLiquidityOfEmergencyAssets,
  toEmergencyFundEvidence,
  scoreAllEmergencyFundCriteria,
} from './emergencyFund/scoreCriteria'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-ef-1',
    display_name: 'Emergency Fund Household',
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

function scoreMonths(input: HouseholdFinancialProgressInput) {
  return scoreEmergencyFundMonths(extractEmergencyFundSignals(input))
}

describe('emergency fund constants', () => {
  it('documents months bands and engine version bump', () => {
    expect(EMERGENCY_FUND_TARGET_MONTHS).toBe(6)
    expect(EMERGENCY_FUND_MONTHS_BANDS[0]).toMatchObject({ minMonthsInclusive: 6, points: 5 })
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('1.0.0')
  })
})

describe('Emergency Fund Months', () => {
  it('scores recorded month bands including edges', () => {
    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '0' } }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '0.5' } }),
          },
        }),
      ).points,
    ).toBe(1)

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '1' } }),
          },
        }),
      ).points,
    ).toBe(2)

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '3' } }),
          },
        }),
      ).points,
    ).toBe(4)

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '6' } }),
          },
        }),
      ),
    ).toMatchObject({ points: 5, status: 'met' })

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ financial: { emergencyFundMonths: '9' } }),
          },
        }),
      ).points,
    ).toBe(5)
  })

  it('uses derived metric and calculated savings ÷ monthly expenses', () => {
    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { emergencyFundMonths: 4 }),
          },
        }),
      ).points,
    ).toBe(4)

    const calculated = scoreMonths(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { emergencySavings: 9000, monthlyEssentialExpenses: 3000 },
          ),
        },
      }),
    )
    expect(calculated.points).toBe(4)
    expect(calculated.explanation).toMatch(/Calculated/)

    const fromAnnual = scoreMonths(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { emergencySavings: 12000, annualEssentialExpenses: 24000 },
          ),
        },
      }),
    )
    // monthly = 2000; 12000/2000 = 6 months
    expect(fromAnnual.points).toBe(5)
  })

  it('handles missing, zero, negative, and non-finite expense/savings inputs', () => {
    expect(scoreMonths(makeInput()).status).toBe('incomplete')

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyEssentialExpenses: 3000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { emergencySavings: 5000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    const zeroExpenses = scoreMonths(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { emergencySavings: 5000, monthlyEssentialExpenses: 0 },
          ),
        },
      }),
    )
    expect(zeroExpenses.status).toBe('incomplete')
    expect(zeroExpenses.explanation).toMatch(/zero or invalid/)

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { emergencySavings: -100, monthlyEssentialExpenses: 3000 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreMonths(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { emergencyFundMonths: Number.NaN }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Dedicated Emergency Fund', () => {
  it('scores yes/no/unknown and rejects undesignated cash balances', () => {
    expect(
      scoreDedicatedEmergencyFund(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { dedicatedEmergencyFund: 'yes' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreDedicatedEmergencyFund(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { dedicatedEmergencyFund: 'no' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreDedicatedEmergencyFund(extractEmergencyFundSignals(makeInput())),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    const cashOnly = scoreDedicatedEmergencyFund(
      extractEmergencyFundSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { checkingBalance: 8000 }),
          },
        }),
      ),
    )
    expect(cashOnly.status).toBe('incomplete')
    expect(cashOnly.explanation).toMatch(/does not prove/)
  })
})

describe('Liquidity of Emergency Assets', () => {
  it('scores liquid, mixed, illiquid, and unknown without treating retirement as liquid', () => {
    expect(
      scoreLiquidityOfEmergencyAssets(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { emergencyFundLiquidity: 'high-yield savings' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreLiquidityOfEmergencyAssets(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { emergencyFundLiquidity: 'mixed' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreLiquidityOfEmergencyAssets(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { emergencyFundLiquidity: 'retirement' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreLiquidityOfEmergencyAssets(extractEmergencyFundSignals(makeInput())),
    ).toMatchObject({ status: 'incomplete', points: 0 })
  })
})

describe('Automatic Savings Habit', () => {
  it('scores enabled/disabled/unknown and ignores generic savings tasks', () => {
    expect(
      scoreAutomaticSavingsHabit(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { automaticEmergencySavings: 'yes' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreAutomaticSavingsHabit(
        extractEmergencyFundSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { automaticEmergencySavings: 'no' }),
            },
          }),
        ),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreAutomaticSavingsHabit(extractEmergencyFundSignals(makeInput())),
    ).toMatchObject({ status: 'incomplete' })

    const genericTask = scoreAutomaticSavingsHabit(
      extractEmergencyFundSignals(
        makeInput({
          openTasks: [
            {
              id: 't1',
              title: 'Increase savings this month',
              due_date: null,
              priority: 'medium',
              status: 'open',
            },
          ],
        }),
      ),
    )
    expect(genericTask.status).toBe('incomplete')
    expect(genericTask.explanation).toMatch(/generic savings task/)
  })
})

describe('emergencyFundCalculator category behavior', () => {
  it('returns insufficient_data when every criterion is incomplete', () => {
    const result = emergencyFundCalculator.calculate(makeInput())
    expect(result.progress.categoryId).toBe('emergency_fund')
    expect(result.progress.maxPoints).toBe(10)
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
    expect(result.progress.evidence).toHaveLength(4)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(new Set(result.recommendations.map((item) => item.actionKey)).size).toBe(
      result.recommendations.length,
    )
  })

  it('computes when at least one criterion is scorable and never exceeds 10', () => {
    const result = emergencyFundCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({ financial: { emergencyFundMonths: '4' } }),
        },
      }),
    )
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(4)
    expect(result.progress.score).toBeLessThanOrEqual(10)

    const evidenceTotal = (result.progress.evidence ?? []).reduce(
      (sum, item) => sum + item.earnedPoints,
      0,
    )
    expect(evidenceTotal).toBe(result.progress.score)
  })

  it('scores a fully evidenced household at 10 points with no recommendations', () => {
    const result = emergencyFundCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            { financial: { emergencyFundMonths: '6' } },
            {
              dedicatedEmergencyFund: 'yes',
              emergencyFundLiquidity: 'savings',
              automaticEmergencySavings: 'yes',
            },
          ),
        },
      }),
    )
    expect(result.progress.score).toBe(10)
    expect(result.recommendations).toEqual([])
    expect(toEmergencyFundEvidence(scoreAllEmergencyFundCriteria(extractEmergencyFundSignals(makeInput())))).toHaveLength(4)
  })

  it('emits educational recommendations for gaps', () => {
    const result = emergencyFundCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            { financial: { emergencyFundMonths: '1' } },
            {
              dedicatedEmergencyFund: 'no',
              emergencyFundLiquidity: 'mixed',
              automaticEmergencySavings: 'no',
            },
          ),
        },
      }),
    )
    expect(result.progress.score).toBe(2 + 0 + 1 + 0)
    expect(result.recommendations.map((item) => item.actionKey)).toEqual(
      expect.arrayContaining([
        'emergency.build_toward_target',
        'emergency.designate_separate_reserve',
        'emergency.keep_reserves_liquid',
        'emergency.establish_automatic_transfer',
      ]),
    )
    expect(
      result.recommendations.every(
        (item) => !/guarantee|best|buy now|urgent|panic/i.test(`${item.title} ${item.body}`),
      ),
    ).toBe(true)
  })
})
