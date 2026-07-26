import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
  HouseholdOpenTaskSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { cashFlowBudgetCalculator } from './cashFlowBudgetCalculator'
import {
  CASH_FLOW_MARGIN_BANDS,
  CASH_FLOW_NET_FALLBACK_POINTS,
  CASH_FLOW_SOURCE_CONFLICT_TOLERANCE,
  RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
  SAVINGS_RATE_BANDS,
} from './cashFlowBudget/constants'
import {
  extractCashFlowBudgetSignals,
  parseRate,
  valuesMateriallyConflict,
} from './cashFlowBudget/extractSignals'
import {
  buildCashFlowBudgetRecommendations,
  scoreAllCashFlowBudgetCriteria,
  scoreBudgetingSystem,
  scoreExpenseTrackingConsistency,
  scoreMonthlyCashFlowPosition,
  scoreSavingsRate,
  summarizeCashFlowBudgetScore,
  toCashFlowBudgetEvidence,
} from './cashFlowBudget/scoreCriteria'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-cf-1',
    display_name: 'Cash Flow Household',
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

function scoreCashFlow(input: HouseholdFinancialProgressInput) {
  return scoreMonthlyCashFlowPosition(extractCashFlowBudgetSignals(input))
}

function scoreBudget(input: HouseholdFinancialProgressInput) {
  return scoreBudgetingSystem(extractCashFlowBudgetSignals(input))
}

function scoreSavings(input: HouseholdFinancialProgressInput) {
  return scoreSavingsRate(extractCashFlowBudgetSignals(input))
}

function scoreTracking(input: HouseholdFinancialProgressInput) {
  return scoreExpenseTrackingConsistency(extractCashFlowBudgetSignals(input))
}

describe('cash flow budget constants', () => {
  it('documents margin/savings bands, conflict tolerance, and engine version', () => {
    expect(CASH_FLOW_MARGIN_BANDS[0]).toMatchObject({ minMarginInclusive: 0.2, points: 6 })
    expect(SAVINGS_RATE_BANDS[0]).toMatchObject({ minRateInclusive: 0.2, points: 4 })
    expect(CASH_FLOW_NET_FALLBACK_POINTS.positive).toBe(3)
    expect(CASH_FLOW_SOURCE_CONFLICT_TOLERANCE).toBe(0.1)
    expect(RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS).toBe(1)
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('0.6.0')
    expect(valuesMateriallyConflict(100, 109)).toBe(false)
    expect(valuesMateriallyConflict(100, 112)).toBe(true)
  })
})

describe('parseRate', () => {
  it('normalizes decimals and whole percents with a documented rule', () => {
    expect(parseRate(0.15)).toBe(0.15)
    expect(parseRate(15)).toBe(0.15)
    expect(parseRate('20%')).toBe(0.2)
    expect(parseRate('1.5%')).toBe(0.015)
    expect(parseRate(1.5)).toBeNull() // ambiguous without %
    expect(parseRate(150)).toBeNull()
    expect(parseRate(-0.1)).toBeNull()
    expect(parseRate(Number.NaN)).toBeNull()
  })
})

describe('Monthly Cash Flow Position', () => {
  it('scores margin bands including edges', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.25 }),
          },
        }),
      ),
    ).toMatchObject({ points: 6, status: 'met' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.2 }),
          },
        }),
      ).points,
    ).toBe(6)

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.15 }),
          },
        }),
      ),
    ).toMatchObject({ points: 5, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.1 }),
          },
        }),
      ).points,
    ).toBe(5)

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.05 }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: -0.1 }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('calculates margin from monthly income and expenses', () => {
    const outcome = scoreCashFlow(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { monthlyIncome: 10000, monthlyExpenses: 8000 },
          ),
        },
      }),
    )
    expect(outcome).toMatchObject({ points: 6, status: 'met' })
    expect(outcome.explanation).toMatch(/income minus monthly household expenses/i)
  })

  it('converts annual income and expenses consistently', () => {
    const outcome = scoreCashFlow(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { annualIncome: 120000, annualExpenses: 96000 },
          ),
        },
      }),
    )
    // monthly 10000 - 8000 = 20%
    expect(outcome.points).toBe(6)
  })

  it('uses recorded net cash flow fallback without inventing a margin', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyNetCashFlow: 500 }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyNetCashFlow: 0 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyNetCashFlow: -200 }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('uses qualitative monthlyCashFlow when numeric margin unavailable', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { monthlyCashFlow: 'save-most-months' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { monthlyCashFlow: 'break-even' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { monthlyCashFlow: 'overspend' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('marks missing, zero, negative, and non-finite income/expenses incomplete', () => {
    expect(scoreCashFlow(makeInput()).status).toBe('incomplete')

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyIncome: 0, monthlyExpenses: 1000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyIncome: -1000, monthlyExpenses: 500 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyIncome: 5000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyIncome: 5000, monthlyExpenses: -100 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: Number.POSITIVE_INFINITY }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('uses monthly income when annual equivalent is within tolerance', () => {
    // monthly 10000 vs annual 108000 → 9000/mo; |10000-9000|/10000 = 10% → within tolerance
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                annualIncome: 108000,
                monthlyExpenses: 7000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 6, status: 'met' })
  })

  it('marks cash flow incomplete when monthly vs annual income exceeds tolerance', () => {
    // monthly 5000 vs annual 120000 → 10000/mo; 50% relative diff
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 5000,
                annualIncome: 120000,
                monthlyExpenses: 3000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })
  })

  it('does not treat housing payment alone as total expenses', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: {
                householdIncome: '120000',
                monthlyHousingPayment: '2500',
              },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Budgeting System', () => {
  it('scores active documented budget as met', () => {
    expect(
      scoreBudget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                hasDocumentedBudget: 'yes',
                budgetingMethod: 'zero-based',
                budgetUse: 'active',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'met' })
  })

  it('scores inconsistent or unconfirmed use as partial', () => {
    expect(
      scoreBudget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { hasBudget: 'yes', budgetReviewStatus: 'inconsistent' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })
  })

  it('scores explicit no budget as unmet', () => {
    expect(
      scoreBudget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { hasBudget: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('does not fully credit vague “tries to budget”', () => {
    expect(
      scoreBudget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { budgetingHabit: 'tries to budget' }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })
  })

  it('marks unknown incomplete', () => {
    expect(scoreBudget(makeInput()).status).toBe('incomplete')
  })

  it('does not treat income/expense values alone as a budget', () => {
    expect(
      scoreBudget(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { monthlyIncome: 8000, monthlyExpenses: 6000 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('does not treat a generic advisor task as proof of a budget', () => {
    const task: HouseholdOpenTaskSummary = {
      id: 't1',
      title: 'Discuss budget with client',
      status: 'open',
      due_date: null,
      priority: 'medium',
    }
    expect(
      scoreBudget(
        makeInput({
          openTasks: [task],
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Savings Rate', () => {
  it('scores rate bands including edges', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0.25 }) },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0.2 }) },
        }),
      ).points,
    ).toBe(4)

    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0.15 }) },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0.1 }) },
        }),
      ).points,
    ).toBe(2)

    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0.05 }) },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreSavings(
        makeInput({
          assessments: { family: makeFamilyAssessment({}, { savingsRate: 0 }) },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('uses derived savings rate and calculated contributions', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { savingsRate: '15%' }),
          },
        }),
      ).points,
    ).toBe(3)

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlySavingsContribution: 2000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })
  })

  it('converts annual contributions to monthly', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                annualSavingsContribution: 24000,
              },
            ),
          },
        }),
      ).points,
    ).toBe(4)
  })

  it('does not double-count duplicate contribution fields', () => {
    const signals = extractCashFlowBudgetSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlySavingsContribution: 1000,
              totalMonthlySavings: 1000,
            },
          ),
        },
      }),
    )
    expect(signals.monthlySavingsContributions).toBe(1000)
    // 1000 / 10000 = 10% → 2 points (not double-counted to 20%).
    expect(scoreSavingsRate(signals).points).toBe(2)
  })

  it('does not count balances or debt payments as savings', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { savingsBalance: 50000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyDebtPayment: 800 }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('caps retirement-only percentage evidence at partial credit without total-rate bands', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { retirementContribution: 'not-saving' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    const over15 = scoreSavings(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: { retirementContribution: 'over-15' },
          }),
        },
      }),
    )
    expect(over15).toMatchObject({
      points: RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
      status: 'partial',
    })
    expect(over15.explanation).toMatch(/total household savings could not be verified/i)
  })

  it('caps retirement-only dollar and employer contributions at partial credit', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { monthlyIncome: 10000, monthlyRetirementContribution: 2000 },
            ),
          },
        }),
      ),
    ).toMatchObject({
      points: RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
      status: 'partial',
    })

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { monthlyIncome: 10000, employerMatch: 500 },
            ),
          },
        }),
      ),
    ).toMatchObject({
      points: RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
      status: 'partial',
    })
  })

  it('treats ambiguous retirement contribution as incomplete', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              financial: { retirementContribution: 'unsure-about-saving' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })
  })

  it('sums distinct non-retirement buckets as verified total contributions', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlyRetirementContribution: 1000,
                monthlyEmergencyContribution: 1000,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })
  })

  it('marks zero income, negative contributions, and implausible rates incomplete', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { monthlyIncome: 0, monthlySavingsContribution: 100 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { monthlyIncome: 5000, monthlySavingsContribution: -50 },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { savingsRate: 150 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Ambiguous non-integer without `%` (1.5 vs 150%) → incomplete
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { savingsRate: 1.5 }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('marks no total savings evidence as incomplete', () => {
    expect(scoreSavings(makeInput()).status).toBe('incomplete')
  })
})

describe('Source conflicts (monthly vs annual)', () => {
  it('accepts expenses within tolerance and rejects beyond tolerance', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlyExpenses: 7000,
                annualExpenses: 75600, // 6300/mo; |7000-6300|/7000 = 10%
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 6, status: 'met' })

    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlyExpenses: 7000,
                annualExpenses: 120000, // 10000/mo — material conflict
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })
  })

  it('accepts savings contributions within tolerance and rejects beyond tolerance', () => {
    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlySavingsContribution: 2000,
                annualSavingsContribution: 21600, // 1800/mo; 10% relative
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                monthlyIncome: 10000,
                monthlySavingsContribution: 2000,
                annualSavingsContribution: 6000, // 500/mo — conflict
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })
  })

  it('does not let one conflicting signal invalidate unrelated criteria', () => {
    const result = cashFlowBudgetCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 5000,
              annualIncome: 120000, // income conflict → cash flow / savings incomplete
              monthlyExpenses: 3000,
              hasDocumentedBudget: 'yes',
              budgetingMethod: 'zero-based',
              budgetUse: 'active',
              expenseTrackingFrequency: 'monthly',
            },
          ),
        },
      }),
    )
    const evidence = result.progress.evidence ?? []
    const byCriterion = Object.fromEntries(
      evidence.map((item) => [item.criterion, item]),
    )
    expect(byCriterion['Monthly Cash Flow Position']?.status).toBe('incomplete')
    expect(byCriterion['Savings Rate']?.status).toBe('incomplete')
    expect(byCriterion['Budgeting System']).toMatchObject({
      status: 'met',
      earnedPoints: 3,
    })
    expect(byCriterion['Expense Tracking Consistency']).toMatchObject({
      status: 'met',
      earnedPoints: 2,
    })
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(5)
  })
})

describe('Derived metric conflicts', () => {
  it('uses consistent derived cash-flow margin', () => {
    const outcome = scoreCashFlow(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlyExpenses: 7000,
              cashFlowMargin: 0.3,
            },
          ),
        },
      }),
    )
    expect(outcome).toMatchObject({ points: 6, status: 'met' })
    expect(outcome.explanation).toMatch(/recorded cash-flow margin/i)
  })

  it('marks conflicting derived cash-flow margin incomplete', () => {
    const outcome = scoreCashFlow(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlyExpenses: 7000,
              cashFlowMargin: 0.5,
            },
          ),
        },
      }),
    )
    expect(outcome).toMatchObject({ points: 0, status: 'incomplete' })
    expect(outcome.explanation).toMatch(/materially conflicts/i)
  })

  it('uses consistent derived savings rate', () => {
    const outcome = scoreSavings(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlySavingsContribution: 2000,
              savingsRate: 0.2,
            },
          ),
        },
      }),
    )
    expect(outcome).toMatchObject({ points: 4, status: 'met' })
    expect(outcome.explanation).toMatch(/recorded total household savings rate/i)
  })

  it('marks conflicting derived savings rate incomplete', () => {
    const outcome = scoreSavings(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlySavingsContribution: 2000,
              savingsRate: 0.05,
            },
          ),
        },
      }),
    )
    expect(outcome).toMatchObject({ points: 0, status: 'incomplete' })
    expect(outcome.explanation).toMatch(/materially conflicts/i)
  })

  it('uses derived metric without sufficient raw data', () => {
    expect(
      scoreCashFlow(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { cashFlowMargin: 0.25 }),
          },
        }),
      ),
    ).toMatchObject({ points: 6, status: 'met' })

    expect(
      scoreSavings(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { savingsRate: 0.2 }),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })
  })

  it('falls back to valid raw calculation when derived metric is invalid', () => {
    const cashFlow = scoreCashFlow(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlyExpenses: 7000,
              cashFlowMargin: 150,
            },
          ),
        },
      }),
    )
    expect(cashFlow).toMatchObject({ points: 6, status: 'met' })
    expect(cashFlow.explanation).toMatch(/income minus monthly household expenses/i)

    const savings = scoreSavings(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlySavingsContribution: 2000,
              savingsRate: 150,
            },
          ),
        },
      }),
    )
    expect(savings).toMatchObject({ points: 4, status: 'met' })
    expect(savings.explanation).toMatch(/verified monthly household savings contributions/i)
  })
})

describe('Expense Tracking Consistency', () => {
  it('scores frequency bands', () => {
    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { expenseTrackingFrequency: 'weekly' }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { expenseTrackingFrequency: 'monthly' }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { expenseTrackingFrequency: 'quarterly' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { expenseTrackingFrequency: 'occasionally' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { expenseTrackingFrequency: 'never' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(scoreTracking(makeInput()).status).toBe('incomplete')
  })

  it('does not treat expense totals alone as tracking', () => {
    expect(
      scoreTracking(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { monthlyExpenses: 4000 }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Cash Flow & Budget category behavior', () => {
  it('returns insufficient_data when all criteria incomplete', () => {
    const result = cashFlowBudgetCalculator.calculate(makeInput())
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
    expect(result.progress.evidence).toHaveLength(4)
  })

  it('computes when at least one criterion is scorable', () => {
    const result = cashFlowBudgetCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: { monthlyCashFlow: 'overspend' },
          }),
        },
      }),
    )
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(0)
  })

  it('can reach 15 points with full evidence', () => {
    const result = cashFlowBudgetCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              monthlyIncome: 10000,
              monthlyExpenses: 7000,
              hasDocumentedBudget: 'yes',
              budgetingMethod: 'envelope system',
              budgetUse: 'active',
              savingsRate: 0.2,
              expenseTrackingFrequency: 'monthly',
            },
          ),
        },
      }),
    )
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(15)
    const evidence = result.progress.evidence ?? []
    const evidenceTotal = evidence.reduce((sum, item) => sum + item.earnedPoints, 0)
    expect(evidenceTotal).toBe(result.progress.score)
    expect(result.progress.score).toBeLessThanOrEqual(15)
    expect(result.recommendations).toHaveLength(0)
  })

  it('keeps evidence totals equal to category score and recommendations deduplicated', () => {
    const signals = extractCashFlowBudgetSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            {
              cashFlowMargin: 0.05,
              hasBudget: 'no',
              savingsRate: 0,
              expenseTrackingFrequency: 'never',
            },
          ),
        },
      }),
    )
    const outcomes = scoreAllCashFlowBudgetCriteria(signals)
    const summarized = summarizeCashFlowBudgetScore(outcomes)
    const evidence = toCashFlowBudgetEvidence(outcomes)
    expect(evidence.reduce((sum, item) => sum + item.earnedPoints, 0)).toBe(summarized.score)
    const recommendations = buildCashFlowBudgetRecommendations(outcomes)
    const keys = recommendations.map((item) => item.actionKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.every((item) => !/guarantee|best|product/i.test(item.body))).toBe(
      true,
    )
  })
})
