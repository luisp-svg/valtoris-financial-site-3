import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
  HouseholdMemberSummary,
  HouseholdPolicySummary,
} from '../../households/types'
import type { HouseholdFinancialProgressInput } from '../types'
import { classifyPolicyType } from './protectionInsurance/classifyPolicy'
import { LTC_PLANNING_APPLICABILITY_AGE } from './protectionInsurance/constants'
import {
  extractProtectionSignals,
  resolveRecordedProtectionNeed,
} from './protectionInsurance/extractSignals'
import {
  scoreBeneficiaryReview,
  scoreLifeInsuranceAdequacy,
  scoreLongTermCarePlanning,
} from './protectionInsurance/scoreCriteria'
import { protectionInsuranceCalculator } from './protectionInsuranceCalculator'

function makeMember(
  overrides: Partial<HouseholdMemberSummary> = {},
): HouseholdMemberSummary {
  return {
    id: 'm-1',
    household_id: 'hh-1',
    first_name: 'Alex',
    last_name: 'Client',
    relationship: 'primary',
    is_primary_contact: true,
    email: null,
    phone: null,
    date_of_birth: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-1',
    display_name: 'Protection Household',
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
    members: [makeMember()],
    ...overrides,
  }
}

function makePolicy(overrides: Partial<HouseholdPolicySummary> = {}): HouseholdPolicySummary {
  return {
    id: 'pol-1',
    carrier: 'Carrier',
    policy_type: 'Term Life',
    status: 'active',
    coverage_amount: 500000,
    renewal_or_review_date: null,
    beneficiary: 'Spouse',
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
    policies: [],
    asOf: '2026-07-26T12:00:00.000Z',
    ...overrides,
  }
}

describe('classifyPolicyType', () => {
  it('classifies common protection product labels', () => {
    expect(classifyPolicyType('Term Life')).toBe('life')
    expect(classifyPolicyType('Whole Life Insurance')).toBe('life')
    expect(classifyPolicyType('Long-Term Disability')).toBe('disability')
    expect(classifyPolicyType('Critical Illness')).toBe('critical_illness')
    expect(classifyPolicyType('Long-Term Care')).toBe('long_term_care')
    expect(classifyPolicyType('Auto')).toBe('other')
  })
})

describe('protection-need methodology (deferred reuse)', () => {
  it('reads recorded protection need and does not invent income×5 need', () => {
    expect(
      resolveRecordedProtectionNeed({
        family: makeFamilyAssessment(
          { financial: { householdIncome: '100000' } },
          { protectionNeed: 750000 },
        ),
      }),
    ).toBe(750000)

    const signals = extractProtectionSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            financial: { householdIncome: '100000' },
            family: { maritalStatus: 'married', numberOfChildren: '2' },
            protection: { currentLifeInsurance: '100000' },
          }),
        },
      }),
    )
    expect(signals.recordedProtectionNeed).toBeNull()
    expect(scoreLifeInsuranceAdequacy(signals).status).toBe('incomplete')
    expect(scoreLifeInsuranceAdequacy(signals).explanation).toMatch(/protection-need analysis/i)
  })
})

describe('beneficiary review scoring', () => {
  it('scores confirmed review, recorded-only, missing, and insufficient data distinctly', () => {
    const confirmed = extractProtectionSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            protection: { beneficiariesReviewed: 'yes' },
          }),
        },
      }),
    )
    const confirmedOutcome = scoreBeneficiaryReview(confirmed)
    expect(confirmedOutcome.points).toBe(2)
    expect(confirmedOutcome.explanation).toMatch(/Confirmed review/i)

    const explicitNo = extractProtectionSignals(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            protection: { beneficiariesReviewed: 'no' },
          }),
        },
      }),
    )
    expect(scoreBeneficiaryReview(explicitNo).points).toBe(0)

    const recordedOnly = extractProtectionSignals(
      makeInput({
        policies: [makePolicy({ beneficiary: 'Sam Client' })],
      }),
    )
    const recordedOutcome = scoreBeneficiaryReview(recordedOnly)
    expect(recordedOutcome.points).toBe(1)
    expect(recordedOutcome.explanation).toMatch(/Recorded beneficiaries only/i)

    const missing = extractProtectionSignals(
      makeInput({
        policies: [makePolicy({ beneficiary: null })],
      }),
    )
    const missingOutcome = scoreBeneficiaryReview(missing)
    expect(missingOutcome.points).toBe(0)
    expect(missingOutcome.explanation).toMatch(/Missing beneficiaries/i)

    const insufficient = scoreBeneficiaryReview(
      extractProtectionSignals(makeInput({ policies: [] })),
    )
    expect(insufficient.status).toBe('incomplete')
    expect(insufficient.explanation).toMatch(/Insufficient data/i)
  })
})

describe('LTC applicability', () => {
  it('marks LTC not_applicable below planning age with neutral credit', () => {
    const signals = extractProtectionSignals(
      makeInput({
        household: makeHousehold({
          members: [
            makeMember({
              date_of_birth: '1980-01-01', // age 46 as of 2026-07-26
            }),
          ],
        }),
        policies: [],
      }),
    )
    const outcome = scoreLongTermCarePlanning(signals)
    expect(LTC_PLANNING_APPLICABILITY_AGE).toBe(50)
    expect(outcome.status).toBe('not_applicable')
    expect(outcome.points).toBe(2)
    expect(outcome.explanation).toMatch(/Not applicable/i)
    expect(outcome.explanation).toMatch(/Neutral credit/i)
  })

  it('treats threshold age as applicable', () => {
    const signals = extractProtectionSignals(
      makeInput({
        household: makeHousehold({
          members: [makeMember({ date_of_birth: '1976-07-26' })], // exactly 50
        }),
      }),
    )
    const outcome = scoreLongTermCarePlanning(signals)
    expect(outcome.status).toBe('incomplete')
    expect(outcome.explanation).toMatch(/Applicable/i)
  })

  it('scores above-threshold households with plan evidence', () => {
    const above = extractProtectionSignals(
      makeInput({
        household: makeHousehold({
          members: [makeMember({ date_of_birth: '1970-01-01' })],
        }),
        assessments: {
          retirement: {
            id: 'r1',
            assessment_type: 'retirement',
            overall_score: null,
            overall_grade: null,
            completed_at: '2026-06-01T00:00:00.000Z',
            answers: { healthcare: { longTermCarePlan: 'self-fund' } },
            derived_metrics: null,
          },
        },
      }),
    )
    expect(scoreLongTermCarePlanning(above).points).toBe(2)
    expect(scoreLongTermCarePlanning(above).explanation).toMatch(/self-fund/)
  })

  it('handles missing ages, existing coverage, and no-plan', () => {
    const missingAges = scoreLongTermCarePlanning(extractProtectionSignals(makeInput()))
    expect(missingAges.status).toBe('incomplete')
    expect(missingAges.explanation).toMatch(/no relevant adult ages/i)

    const withCoverage = scoreLongTermCarePlanning(
      extractProtectionSignals(
        makeInput({
          policies: [makePolicy({ id: 'ltc', policy_type: 'Long-Term Care', beneficiary: null })],
        }),
      ),
    )
    expect(withCoverage.status).toBe('met')
    expect(withCoverage.points).toBe(2)

    const noPlan = scoreLongTermCarePlanning(
      extractProtectionSignals(
        makeInput({
          household: makeHousehold({
            members: [makeMember({ date_of_birth: '1965-01-01' })],
          }),
          assessments: {
            retirement: {
              id: 'r1',
              assessment_type: 'retirement',
              overall_score: null,
              overall_grade: null,
              completed_at: '2026-06-01T00:00:00.000Z',
              answers: { healthcare: { longTermCarePlan: 'no-plan' } },
              derived_metrics: null,
            },
          },
        }),
      ),
    )
    expect(noPlan.status).toBe('unmet')
    expect(noPlan.points).toBe(0)
  })

  it('does not penalize below-age households in the category total', () => {
    const result = protectionInsuranceCalculator.calculate(
      makeInput({
        household: makeHousehold({
          members: [makeMember({ date_of_birth: '1985-06-01' })],
        }),
        policies: [
          makePolicy({
            policy_type: 'Critical Illness',
            coverage_amount: 25000,
            beneficiary: null,
          }),
        ],
        assessments: {
          family: makeFamilyAssessment({
            protection: {
              hasDisabilityProtection: 'yes',
              beneficiariesReviewed: 'yes',
            },
          }),
        },
      }),
    )

    // Life incomplete (0) + DI 2 + CI 1 + LTC N/A neutral 2 + beneficiary confirmed 2 = 7
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(7)
    expect(result.progress.summary).toMatch(/not applicable/i)
  })
})

describe('protectionInsuranceCalculator', () => {
  it('returns insufficient_data when every scoreable criterion lacks required inputs', () => {
    const result = protectionInsuranceCalculator.calculate(
      makeInput({ policies: undefined }),
    )

    expect(result.progress.categoryId).toBe('protection_insurance')
    expect(result.progress.maxPoints).toBe(15)
    expect(result.progress.status).toBe('insufficient_data')
    expect(result.progress.score).toBeNull()
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('scores a fully protected household at the 15-point maximum using recorded need', () => {
    const result = protectionInsuranceCalculator.calculate(
      makeInput({
        household: makeHousehold({
          members: [
            makeMember({ id: 'm-1', relationship: 'primary', date_of_birth: '1970-01-01' }),
            makeMember({ id: 'm-2', relationship: 'spouse', first_name: 'Sam' }),
          ],
        }),
        policies: [
          makePolicy({
            id: 'life-1',
            policy_type: 'Term Life',
            coverage_amount: 1_000_000,
            beneficiary: 'Sam Client',
          }),
          makePolicy({
            id: 'di-1',
            policy_type: 'Long-Term Disability',
            coverage_amount: 5000,
            beneficiary: null,
          }),
          makePolicy({
            id: 'ci-1',
            policy_type: 'Critical Illness',
            coverage_amount: 50000,
            beneficiary: null,
          }),
          makePolicy({
            id: 'ltc-1',
            policy_type: 'Long-Term Care',
            coverage_amount: 200000,
            beneficiary: null,
          }),
        ],
        assessments: {
          family: makeFamilyAssessment(
            {
              protection: {
                currentLifeInsurance: '0',
                hasDisabilityProtection: 'yes',
                beneficiariesReviewed: 'yes',
              },
            },
            { protectionNeed: 800000 },
          ),
        },
      }),
    )

    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(15)
    expect(result.recommendations).toEqual([])
  })

  it('awards partial life points from recorded need and recommends gaps', () => {
    const result = protectionInsuranceCalculator.calculate(
      makeInput({
        household: makeHousehold({
          members: [makeMember({ date_of_birth: '1970-01-01' })],
        }),
        policies: [
          makePolicy({
            policy_type: 'Term Life',
            coverage_amount: 125000,
            beneficiary: null,
          }),
        ],
        assessments: {
          family: makeFamilyAssessment(
            {
              protection: {
                currentLifeInsurance: '125000',
                hasDisabilityProtection: 'no',
                beneficiariesReviewed: 'no',
              },
            },
            { protectionNeed: 500000 },
          ),
        },
      }),
    )

    // Life 2 + DI 0 + CI 0 + LTC incomplete 0 + beneficiary 0 = 2
    expect(result.progress.status).toBe('computed')
    expect(result.progress.score).toBe(2)
    expect(result.recommendations.map((item) => item.actionKey)).toEqual(
      expect.arrayContaining([
        'protection.review_life_insurance',
        'protection.discuss_disability',
        'protection.review_critical_illness',
        'protection.discuss_long_term_care',
        'protection.complete_beneficiary_review',
      ]),
    )
  })

  it('does not treat beneficiary presence as a completed review', () => {
    const result = protectionInsuranceCalculator.calculate(
      makeInput({
        policies: [
          makePolicy({
            policy_type: 'Term Life',
            coverage_amount: 1_000_000,
            beneficiary: 'Spouse',
          }),
        ],
      }),
    )

    // Life incomplete + DI incomplete + CI unmet 0 + LTC incomplete + beneficiary recorded-only 1
    expect(result.progress.score).toBe(1)
    expect(result.recommendations.map((item) => item.actionKey)).toEqual(
      expect.arrayContaining([
        'protection.complete_protection_needs_analysis',
        'protection.complete_beneficiary_review',
      ]),
    )
  })
})
