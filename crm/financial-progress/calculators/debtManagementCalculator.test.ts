import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { debtManagementCalculator } from './debtManagementCalculator'
import {
  DEBT_PAYOFF_PARTIAL_POINTS,
  DEBT_TO_INCOME_POSITION_BANDS,
  HIGH_INTEREST_APR_THRESHOLD,
} from './debtManagement/constants'
import { extractDebtSignals, parseApr } from './debtManagement/extractSignals'
import {
  scoreCreditCardUtilization,
  scoreDebtPayoffStrategy,
  scoreDebtToIncomePosition,
  scoreHighInterestDebt,
} from './debtManagement/scoreCriteria'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-debt-1',
    display_name: 'Debt Household',
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

describe('shared debt constants', () => {
  it('documents high-interest APR threshold and DTI-position bands', () => {
    expect(HIGH_INTEREST_APR_THRESHOLD).toBe(0.2)
    expect(DEBT_TO_INCOME_POSITION_BANDS.map((band) => band.points)).toEqual([5, 5, 4, 3, 1, 0])
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('0.4.0')
  })
})

describe('debtManagementCalculator evidence', () => {
  it('returns shared CriterionEvidence for each criterion', () => {
    const result = debtManagementCalculator.calculate(makeInput())
    const evidence = result.progress.evidence

    expect(evidence).toHaveLength(4)
    expect(evidence?.map((item) => item.criterion)).toEqual([
      'Credit Card Utilization',
      'High-Interest Debt',
      'Debt-to-Income Position',
      'Debt Payoff Strategy',
    ])
    for (const item of evidence ?? []) {
      expect(item).toEqual(
        expect.objectContaining({
          criterion: expect.any(String),
          earnedPoints: expect.any(Number),
          maxPoints: 5,
          status: expect.stringMatching(
            /^(met|partial|unmet|incomplete|not_applicable)$/,
          ),
          explanation: expect.any(String),
        }),
      )
    }
  })
})

describe('high-interest debt APR evidence', () => {
  it('scores APR below, at, and above HIGH_INTEREST_APR_THRESHOLD', () => {
    expect(parseApr(0.199)).toBeCloseTo(0.199)
    expect(parseApr('20%')).toBe(0.2)

    const below = scoreHighInterestDebt(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { apr: 0.199 }),
          },
        }),
      ),
    )
    expect(below.status).toBe('met')
    expect(below.points).toBe(5)
    expect(below.explanation).toMatch(/below the high-interest threshold/)

    const at = scoreHighInterestDebt(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { apr: HIGH_INTEREST_APR_THRESHOLD }),
          },
        }),
      ),
    )
    expect(at.status).toBe('unmet')
    expect(at.points).toBe(0)
    expect(at.explanation).toMatch(/at or above the high-interest threshold/)

    const above = scoreHighInterestDebt(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { apr: 0.29 }),
          },
        }),
      ),
    )
    expect(above.status).toBe('unmet')
    expect(above.points).toBe(0)
  })

  it('honors explicit high-interest flag and rejects card balance without APR', () => {
    expect(
      scoreHighInterestDebt(
        extractDebtSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { hasHighInterestDebt: 'no' }),
            },
          }),
        ),
      ).points,
    ).toBe(5)

    expect(
      scoreHighInterestDebt(
        extractDebtSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { hasHighInterestDebt: 'yes' }),
            },
          }),
        ),
      ).status,
    ).toBe('unmet')

    const cardOnly = scoreHighInterestDebt(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              debt: { creditCardDebt: '8000' },
            }),
          },
        }),
      ),
    )
    expect(cardOnly.status).toBe('incomplete')
    expect(cardOnly.points).toBe(0)
    expect(cardOnly.explanation).toMatch(/Interest-rate data is missing/)

    expect(scoreHighInterestDebt(extractDebtSignals(makeInput())).status).toBe('incomplete')
  })
})

describe('debt-to-income position', () => {
  it('scores total recorded debt ÷ annual income and handles invalid units', () => {
    const strong = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { householdIncome: '100000', totalDebt: '20000' },
            }),
          },
        }),
      ),
    )
    expect(strong.points).toBe(5)
    expect(strong.explanation).toMatch(/Debt-to-Income Position/)
    expect(strong.explanation).toMatch(/not monthly DTI/i)
    expect(strong.explanation).not.toMatch(/consumer debt/i)

    const zeroDebt = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { householdIncome: '90000', totalDebt: '0' },
            }),
          },
        }),
      ),
    )
    expect(zeroDebt.points).toBe(5)

    const missingIncome = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { totalDebt: '10000' },
            }),
          },
        }),
      ),
    )
    expect(missingIncome.status).toBe('incomplete')

    const zeroIncome = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { householdIncome: 0, totalDebt: 10000 },
            ),
          },
        }),
      ),
    )
    expect(zeroIncome.status).toBe('incomplete')

    const negativeIncome = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { householdIncome: -50000, totalDebt: 10000 },
            ),
          },
        }),
      ),
    )
    expect(negativeIncome.status).toBe('incomplete')

    const missingDebt = scoreDebtToIncomePosition(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { householdIncome: '90000' },
            }),
          },
        }),
      ),
    )
    expect(missingDebt.status).toBe('incomplete')
  })
})

describe('debt payoff strategy', () => {
  it('scores complete, partial, unmet, not_applicable, and incomplete outcomes', () => {
    const complete = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { debtPayoffStrategy: 'avalanche' }),
          },
        }),
      ),
    )
    expect(complete.status).toBe('met')
    expect(complete.points).toBe(5)

    const completePlan = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { payoffOrder: 'cards then auto', targetPayment: 500 },
            ),
          },
        }),
      ),
    )
    expect(completePlan.status).toBe('met')
    expect(completePlan.points).toBe(5)

    const partialIntent = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              { financial: { totalDebt: '12000', householdIncome: '90000' } },
              { debtPayoffStrategy: 'yes' },
            ),
          },
        }),
      ),
    )
    expect(partialIntent.status).toBe('partial')
    expect(partialIntent.points).toBe(DEBT_PAYOFF_PARTIAL_POINTS)

    const partialTask = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { totalDebt: '12000', householdIncome: '90000' },
            }),
          },
          openTasks: [
            {
              id: 't1',
              title: 'Discuss debt payoff next meeting',
              due_date: null,
              priority: 'high',
              status: 'open',
            },
          ],
        }),
      ),
    )
    expect(partialTask.status).toBe('partial')
    expect(partialTask.points).toBe(2)

    const unrelatedTask = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { totalDebt: '12000', householdIncome: '90000' },
            }),
          },
          openTasks: [
            {
              id: 't2',
              title: 'Schedule annual review',
              due_date: null,
              priority: 'medium',
              status: 'open',
            },
          ],
        }),
      ),
    )
    expect(unrelatedTask.status).toBe('unmet')
    expect(unrelatedTask.points).toBe(0)

    const noDebt = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { totalDebt: '0', householdIncome: '90000' },
            }),
          },
        }),
      ),
    )
    expect(noDebt.status).toBe('not_applicable')
    expect(noDebt.points).toBe(5)

    const unmet = scoreDebtPayoffStrategy(
      extractDebtSignals(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { totalDebt: '25000', householdIncome: '90000' },
            }),
          },
        }),
      ),
    )
    expect(unmet.status).toBe('unmet')
    expect(unmet.points).toBe(0)

    expect(scoreDebtPayoffStrategy(extractDebtSignals(makeInput())).status).toBe('incomplete')
  })
})

describe('debtManagementCalculator', () => {
  it('returns insufficient_data when every scoreable criterion is incomplete', () => {
    const result = debtManagementCalculator.calculate(makeInput())
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('scores a strong household at the 20-point maximum', () => {
    const result = debtManagementCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {
              financial: { householdIncome: '120000', totalDebt: '10000' },
            },
            {
              creditCardUtilization: 0.05,
              apr: 0.15,
              debtPayoffStrategy: 'snowball',
            },
          ),
        },
      }),
    )

    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(20)
    expect(result.recommendations).toEqual([])
  })

  it('emits educational recommendations for gaps without fabricating data', () => {
    const result = debtManagementCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: { householdIncome: '90000', totalDebt: '120000' },
            debt: { creditCardDebt: '5000' },
          }),
        },
      }),
    )

    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(1)
    expect(result.recommendations.map((item) => item.actionKey)).toEqual(
      expect.arrayContaining([
        'debt.review_credit_card_utilization',
        'debt.review_apr',
        'debt.review_debt_to_income_position',
        'debt.document_payoff_strategy',
      ]),
    )
  })

  it('still scores utilization independently of high-interest APR rules', () => {
    expect(
      scoreCreditCardUtilization(
        extractDebtSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { creditCardUtilization: 0.45 }),
            },
          }),
        ),
      ).points,
    ).toBe(3)
  })
})
