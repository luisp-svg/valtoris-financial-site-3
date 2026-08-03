import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { creditHealthCalculator } from './creditHealthCalculator'
import {
  CREDIT_HEALTH_CRITERION_MAX_POINTS,
  CREDIT_REVIEW_CURRENT_MONTHS,
  CREDIT_UTILIZATION_BANDS,
  PAYMENT_HISTORY_RECENT_MONTHS,
} from './creditHealth/constants'
import { extractCreditHealthSignals } from './creditHealth/extractSignals'
import {
  buildCreditHealthRecommendations,
  scoreAllCreditHealthCriteria,
  scoreCreditMonitoringReview,
  scoreCreditProfileStability,
  scoreCreditUtilization,
  scorePaymentHistory,
  summarizeCreditHealthScore,
  toCreditHealthEvidence,
} from './creditHealth/scoreCriteria'

const AS_OF = '2026-07-26T12:00:00.000Z'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-credit-1',
    display_name: 'Credit Household',
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

function makeInput(
  overrides: Partial<HouseholdFinancialProgressInput> = {},
): HouseholdFinancialProgressInput {
  return {
    household: makeHousehold(),
    asOf: AS_OF,
    ...overrides,
  }
}

function scorePay(input: HouseholdFinancialProgressInput) {
  return scorePaymentHistory(extractCreditHealthSignals(input))
}

function scoreUtil(input: HouseholdFinancialProgressInput) {
  return scoreCreditUtilization(extractCreditHealthSignals(input))
}

function scoreProfile(input: HouseholdFinancialProgressInput) {
  return scoreCreditProfileStability(extractCreditHealthSignals(input))
}

function scoreMonitor(input: HouseholdFinancialProgressInput) {
  return scoreCreditMonitoringReview(extractCreditHealthSignals(input))
}

describe('credit health constants', () => {
  it('documents budgets, recency windows, and engine version', () => {
    expect(CREDIT_HEALTH_CRITERION_MAX_POINTS.payment_history).toBe(4)
    expect(CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_utilization).toBe(3)
    expect(CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_profile_stability).toBe(2)
    expect(CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_monitoring_review).toBe(1)
    expect(PAYMENT_HISTORY_RECENT_MONTHS).toBe(24)
    expect(CREDIT_REVIEW_CURRENT_MONTHS).toBe(12)
    expect(CREDIT_UTILIZATION_BANDS[0]).toMatchObject({ maxExclusive: 0.1, points: 3 })
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('1.0.0')
  })
})

describe('Payment History recency', () => {
  it('scores clean, recent lates, collections, charge-offs, boundaries, and unknown dates', () => {
    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              credit: { currentOnPayments: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { recentLatePayments: 1 }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { recentLatePayments: 2 }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { hasActiveCollection: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                collectionsCount: 1,
                collectionReportedDate: '2025-07-26T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    const historicalCollection = scorePay(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            { credit: { currentOnPayments: 'yes' } },
            {
              collectionsCount: 1,
              collectionReportedDate: '2024-06-26T00:00:00.000Z',
            },
          ),
        },
      }),
    )
    expect(historicalCollection).toMatchObject({ points: 3, status: 'partial' })
    expect(historicalCollection.explanation).toMatch(/Historical derogatory/i)
    expect(historicalCollection.explanation).not.toMatch(/conflict/i)

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                chargeOffCount: 1,
                chargeOffDate: '2025-01-01T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    const historicalChargeOff = scorePay(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            { credit: { currentOnPayments: 'yes' } },
            {
              chargeOffCount: 1,
              chargeOffDate: '2023-01-01T00:00:00.000Z',
            },
          ),
        },
      }),
    )
    expect(historicalChargeOff).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                hasSevereDerogatory: 'yes',
                derogatoryEventDate: '2025-12-01T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { collectionsCount: 1 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { collectionsCount: 1, collectionReportedDate: 'not-a-date' },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Exact 24-month boundary → recent
    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                collectionsCount: 1,
                collectionReportedDate: '2024-07-26T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    // Just outside 24 months → historical (with clean current → 3)
    expect(
      scorePay(
        makeInput({
          asOf: AS_OF,
          assessments: {
            family: makeFamilyAssessment(
              { credit: { currentOnPayments: 'yes' } },
              {
                collectionsCount: 1,
                collectionReportedDate: '2024-06-26T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    // Deterministic asOf: same dated event is historical vs recent depending on asOf
    const eventDate = '2024-01-01T00:00:00.000Z'
    expect(
      scorePay(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              { credit: { currentOnPayments: 'yes' } },
              { collectionsCount: 1, collectionReportedDate: eventDate },
            ),
          },
        }),
      ).points,
    ).toBe(3) // historical under 2026 asOf
    expect(
      scorePay(
        makeInput({
          asOf: '2025-01-01T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              {},
              { collectionsCount: 1, collectionReportedDate: eventDate },
            ),
          },
        }),
      ).points,
    ).toBe(1) // recent under 2025 asOf
  })
})

describe('Payment History clean-status reconciliation', () => {
  it('reconciles clean fields with derogatory evidence without silent overrides', () => {
    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              credit: { currentOnPayments: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              { credit: { currentOnPayments: 'yes' } },
              {
                collectionsCount: 1,
                collectionReportedDate: '2025-07-01T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              { credit: { currentOnPayments: 'yes' } },
              {
                chargeOffCount: 1,
                chargeOffDate: '2025-07-01T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'incomplete' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                latePaymentCount: 0,
                paymentHistoryReportingAsOf: '2026-06-01T00:00:00.000Z',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scorePay(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { latePaymentCount: 0 }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    const historicalResolved = scorePay(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            { credit: { currentOnPayments: 'yes' } },
            {
              collectionsCount: 1,
              collectionStatus: 'resolved',
              collectionReportedDate: '2023-01-01T00:00:00.000Z',
            },
          ),
        },
      }),
    )
    expect(historicalResolved.points).toBe(3)
    expect(historicalResolved.explanation).toMatch(/Historical/i)
    expect(historicalResolved.explanation).not.toMatch(/Material conflict/i)

    const samePeriodConflict = scorePay(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            credit: {
              currentOnPayments: 'yes',
              recentLatePayments: 2,
            },
          }),
        },
      }),
    )
    expect(samePeriodConflict.status).toBe('incomplete')
    expect(samePeriodConflict.explanation).toMatch(/conflict/i)

    // Conflict isolation: utilization still scores
    const mixed = creditHealthCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {
              credit: {
                currentOnPayments: 'yes',
                recentLatePayments: 1,
              },
            },
            {
              creditCardUtilization: 0.05,
              oldestAccountAgeMonths: 96,
              creditMonitoringEnabled: 'yes',
            },
          ),
        },
      }),
    )
    const byCriterion = Object.fromEntries(
      (mixed.progress.evidence ?? []).map((item) => [item.criterion, item]),
    )
    expect(byCriterion['Payment History']?.status).toBe('incomplete')
    expect(byCriterion['Credit Utilization']?.earnedPoints).toBe(3)
    expect(byCriterion['Credit Profile Stability']?.earnedPoints).toBe(2)
    expect(byCriterion['Credit Monitoring & Review']?.earnedPoints).toBe(1)
  })
})

describe('Credit Utilization', () => {
  it('scores utilization thresholds and incomplete cases', () => {
    const cases: Array<[number, number]> = [
      [0, 3],
      [0.09, 3],
      [0.1, 2],
      [0.29, 2],
      [0.3, 1],
      [0.49, 1],
      [0.5, 0],
      [1, 0],
    ]
    for (const [ratio, points] of cases) {
      expect(
        scoreUtil(
          makeInput({
            assessments: {
              family: makeFamilyAssessment({}, { creditCardUtilization: ratio }),
            },
          }),
        ),
      ).toMatchObject({
        points,
        status: points === 3 ? 'met' : points === 0 ? 'unmet' : 'partial',
      })
    }

    expect(scoreUtil(makeInput()).status).toBe('incomplete')

    expect(
      scoreUtil(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              debt: { creditCardDebt: '2000' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Credit Profile Stability', () => {
  it('scores mature, moderate, new, inquiry-heavy, and unknown profiles', () => {
    expect(
      scoreProfile(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                oldestAccountAgeMonths: 96,
                recentInquiries12m: 1,
                newAccounts12m: 0,
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreProfile(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { oldestAccountAgeMonths: 36 }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(scoreProfile(makeInput()).status).toBe('incomplete')
  })
})

describe('Credit Monitoring freshness', () => {
  it('requires current monitoring or dated review within 12 months', () => {
    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { creditMonitoringEnabled: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { creditAlertsEnabled: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { annualCreditReviewDate: '2026-01-26T00:00:00.000Z' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    // Exact 12-month boundary
    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { advisorCreditReviewDate: '2025-07-26T00:00:00.000Z' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    const outdated = scoreMonitor(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {},
            { annualCreditReviewDate: '2025-06-26T00:00:00.000Z' },
          ),
        },
      }),
    )
    expect(outdated).toMatchObject({ points: 0, status: 'unmet' })
    expect(
      buildCreditHealthRecommendations(
        scoreAllCreditHealthCriteria(extractCreditHealthSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment(
                {},
                { annualCreditReviewDate: '2025-06-26T00:00:00.000Z' },
              ),
            },
          }),
        )),
        extractCreditHealthSignals(
          makeInput({
            assessments: {
              family: makeFamilyAssessment(
                {},
                { annualCreditReviewDate: '2025-06-26T00:00:00.000Z' },
              ),
            },
          }),
        ),
      ).some((item) => /credit reports and monitoring settings/i.test(item.body)),
    ).toBe(true)

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { advisorCreditReview: 'yes' }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { annualCreditReviewDocumented: 'yes' }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { creditReviewStatus: 'current' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'met' })

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { creditMonitoringEnabled: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { annualCreditReviewDate: 'not-a-date' },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreMonitor(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                creditMonitoringEnabled: 'yes',
                credit_monitoring_enabled: 'no',
              },
            ),
          },
        }),
      ).status,
    ).toBe('incomplete')

    // Deterministic asOf for review freshness
    expect(
      scoreMonitor(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              {},
              { creditReviewDate: '2025-08-01T00:00:00.000Z' },
            ),
          },
        }),
      ).points,
    ).toBe(1)
    expect(
      scoreMonitor(
        makeInput({
          asOf: '2027-08-01T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              {},
              { creditReviewDate: '2025-08-01T00:00:00.000Z' },
            ),
          },
        }),
      ).points,
    ).toBe(0)
  })
})

describe('creditHealthCalculator category behavior', () => {
  it('returns insufficient_data when all criteria incomplete', () => {
    expect(creditHealthCalculator.calculate(makeInput()).progress.status).toBe(
      'insufficient_data',
    )
  })

  it('computes from one criterion; evidence totals equal score; max 10', () => {
    const one = creditHealthCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({}, { creditCardUtilization: 0.05 }),
        },
      }),
    )
    expect(one.progress.status).toBe('computed')
    expect(one.progress.score).toBe(3)
    expect(
      (one.progress.evidence ?? []).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(one.progress.score)
    expect(one.progress.score).toBeLessThanOrEqual(10)
    expect(one.recommendations.every((item) => !/dispute|credit.?repair/i.test(item.body))).toBe(
      true,
    )
  })

  it('scores a full 10-point path and dedupes recommendations', () => {
    const full = creditHealthCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment(
            {
              credit: {
                currentOnPayments: 'yes',
              },
            },
            {
              creditCardUtilization: 0.05,
              oldestAccountAgeMonths: 120,
              recentInquiries12m: 0,
              newAccounts12m: 0,
              creditMonitoringEnabled: 'yes',
            },
          ),
        },
      }),
    )
    expect(full.progress.status).toBe('computed')
    expect(full.progress.score).toBe(10)
    expect(full.progress.evidence).toHaveLength(4)
    expect(full.recommendations).toHaveLength(0)

    const signals = extractCreditHealthSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({}, { creditMonitoringEnabled: 'no' }),
        },
      }),
    )
    const outcomes = scoreAllCreditHealthCriteria(signals)
    const recommendations = buildCreditHealthRecommendations(outcomes, signals)
    const keys = recommendations.map((item) => item.actionKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(recommendations.filter((item) => item.actionKey.startsWith('credit.')).length).toBeLessThanOrEqual(
      outcomes.length,
    )
    expect(
      toCreditHealthEvidence(outcomes).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(summarizeCreditHealthScore(outcomes).score)
  })

  it('does not infer credit health from income, net worth, or home ownership', () => {
    const result = creditHealthCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: {
              householdIncome: '250000',
              netWorth: '1000000',
              homeOwnership: 'own',
            },
          }),
        },
      }),
    )
    expect(result.progress.status).toBe('insufficient_data')
  })
})
