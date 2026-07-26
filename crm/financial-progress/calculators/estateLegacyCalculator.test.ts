import { describe, expect, it } from 'vitest'
import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
  HouseholdOpenTaskSummary,
} from '../../households/types'
import { FINANCIAL_PROGRESS_ENGINE_VERSION } from '../constants'
import type { HouseholdFinancialProgressInput } from '../types'
import { estateLegacyCalculator } from './estateLegacyCalculator'
import {
  BENEFICIARY_REVIEW_CURRENT_MONTHS,
  ESTATE_LEGACY_CRITERION_MAX_POINTS,
} from './estateLegacy/constants'
import { extractEstateLegacySignals } from './estateLegacy/extractSignals'
import {
  buildEstateLegacyRecommendations,
  scoreAllEstateLegacyCriteria,
  scoreBeneficiaryOwnershipReview,
  scoreCoreEstateDocuments,
  scoreEstateOrganizationLegacyInstructions,
  scoreGuardianshipPlanning,
  summarizeEstateLegacyScore,
  toEstateLegacyEvidence,
} from './estateLegacy/scoreCriteria'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-estate-1',
    display_name: 'Estate Household',
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

function makeInput(
  overrides: Partial<HouseholdFinancialProgressInput> = {},
): HouseholdFinancialProgressInput {
  return {
    household: makeHousehold(),
    asOf: '2026-07-26T12:00:00.000Z',
    ...overrides,
  }
}

function scoreDocs(input: HouseholdFinancialProgressInput) {
  return scoreCoreEstateDocuments(extractEstateLegacySignals(input))
}

function scoreReview(input: HouseholdFinancialProgressInput) {
  return scoreBeneficiaryOwnershipReview(extractEstateLegacySignals(input))
}

function scoreGuardian(input: HouseholdFinancialProgressInput) {
  return scoreGuardianshipPlanning(extractEstateLegacySignals(input))
}

function scoreOrg(input: HouseholdFinancialProgressInput) {
  return scoreEstateOrganizationLegacyInstructions(extractEstateLegacySignals(input))
}

describe('estate legacy constants', () => {
  it('documents budgets, review window, and engine version', () => {
    expect(ESTATE_LEGACY_CRITERION_MAX_POINTS.core_estate_documents).toBe(4)
    expect(BENEFICIARY_REVIEW_CURRENT_MONTHS).toBe(24)
    expect(FINANCIAL_PROGRESS_ENGINE_VERSION).toBe('0.7.0')
  })
})

describe('Core Estate Documents', () => {
  it('allocates will=2, financial POA=1, healthcare=1; trust never required', () => {
    expect(
      scoreDocs(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({ protection: { hasWill: 'yes' } }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'partial' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { hasPowerOfAttorney: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({}, { healthcareDirective: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { hasWill: 'yes', hasPowerOfAttorney: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              { protection: { hasWill: 'yes' } },
              { healthcareDirective: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 3, status: 'partial' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { hasWill: 'yes', hasPowerOfAttorney: 'yes' },
            }),
            family: makeFamilyAssessment({}, { healthcareDirective: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: {
                hasWill: 'yes',
                hasTrust: 'yes',
                hasPowerOfAttorney: 'yes',
              },
            }),
            family: makeFamilyAssessment({}, { healthcareDirective: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 4, status: 'met' })

    const trustOnly = scoreDocs(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({ protection: { hasTrust: 'yes' } }),
        },
      }),
    )
    expect(trustOnly).toMatchObject({ points: 0, status: 'incomplete' })
    expect(trustOnly.explanation).toMatch(/trust was reported/i)

    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: {
                hasWill: 'no',
                hasPowerOfAttorney: 'no',
              },
            }),
            family: makeFamilyAssessment({}, { healthcareDirective: 'no' }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })
  })

  it('dedupes aliases; trust conflict does not invalidate scored documents', () => {
    expect(
      scoreDocs(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              { estate: { hasPowerOfAttorney: 'yes' } },
              { estatePlanDocuments: ['durable-power-of-attorney', 'will'] },
            ),
          },
        }),
      ).points,
    ).toBe(3) // will 2 + POA 1

    const conflict = scoreDocs(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({ protection: { hasWill: 'yes', hasTrust: 'yes' } }),
          retirement: makeRetirementAssessment({
            estate: { hasWill: 'no', hasPowerOfAttorney: 'yes', hasTrust: 'no' },
          }),
        },
      }),
    )
    expect(conflict.points).toBe(1) // POA only; will conflict; trust conflict ignored for points
    expect(conflict.explanation).toMatch(/conflicting/i)
    expect(conflict.explanation).toMatch(/trust/i)
  })

  it('does not infer documents from ownership, children, beneficiaries, or tasks', () => {
    const task: HouseholdOpenTaskSummary = {
      id: 't1',
      title: 'Discuss estate plan',
      due_date: null,
      priority: 'medium',
      status: 'open',
    }
    expect(
      scoreDocs(
        makeInput({
          openTasks: [task],
          assessments: {
            family: makeFamilyAssessment({
              family: { numberOfChildren: '2' },
              protection: { beneficiariesReviewed: 'yes' },
            }),
          },
          policies: [
            {
              id: 'p1',
              carrier: 'Acme',
              policy_type: 'Term Life',
              status: 'active',
              coverage_amount: 100000,
              renewal_or_review_date: null,
              beneficiary: 'Spouse',
            },
          ],
        }),
      ).status,
    ).toBe('incomplete')
  })
})

describe('Beneficiary & Ownership Review', () => {
  it('scores current, partial/outdated, unmet, and presence-only incomplete', () => {
    expect(
      scoreReview(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              protection: { beneficiariesReviewed: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreReview(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              { beneficiaryReviewStatus: 'outdated' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreReview(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              protection: { beneficiariesReviewed: 'no' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreReview(
        makeInput({
          policies: [
            {
              id: 'p1',
              carrier: 'Acme',
              policy_type: 'Term Life',
              status: 'active',
              coverage_amount: 100000,
              renewal_or_review_date: null,
              beneficiary: 'Spouse',
            },
          ],
        }),
      ).status,
    ).toBe('incomplete')
  })

  it('uses injectable asOf for review-date currency', () => {
    expect(
      scoreReview(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              {},
              { beneficiaryReviewDate: '2025-01-01' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreReview(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          assessments: {
            family: makeFamilyAssessment(
              {},
              { beneficiaryReviewDate: '2023-01-01' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })
  })
})

function makeChildMember(
  overrides: {
    id?: string
    date_of_birth?: string | null
    relationship?: 'child' | 'dependent'
  } = {},
) {
  return {
    id: overrides.id ?? 'm1',
    household_id: 'hh-estate-1',
    first_name: 'Kid',
    last_name: 'One',
    email: null,
    phone: null,
    date_of_birth: overrides.date_of_birth === undefined ? '2015-01-01' : overrides.date_of_birth,
    relationship: overrides.relationship ?? ('child' as const),
    is_primary_contact: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('Guardianship Planning', () => {
  it('requires confirmed minor/dependent status; child count alone is incomplete', () => {
    expect(
      scoreGuardian(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              family: { numberOfChildren: '2' },
              protection: { guardianDocumented: 'yes' },
            }),
          },
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGuardian(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          household: makeHousehold({
            members: [makeChildMember({ date_of_birth: null })],
          }),
        }),
      ).status,
    ).toBe('incomplete')

    expect(
      scoreGuardian(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          household: makeHousehold({
            members: [makeChildMember({ date_of_birth: '2015-01-01' })],
          }),
          assessments: {
            family: makeFamilyAssessment({
              protection: { guardianDocumented: 'yes' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreGuardian(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          household: makeHousehold({
            members: [makeChildMember({ date_of_birth: '2015-01-01' })],
          }),
          assessments: {
            family: makeFamilyAssessment({
              protection: { guardianDocumented: 'no' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'unmet' })

    expect(
      scoreGuardian(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          household: makeHousehold({
            members: [makeChildMember({ date_of_birth: '1990-01-01' })],
          }),
        }),
      ),
    ).toMatchObject({ points: 0, status: 'not_applicable' })

    expect(
      scoreGuardian(
        makeInput({
          asOf: '2026-07-26T00:00:00.000Z',
          household: makeHousehold({
            members: [
              makeChildMember({ id: 'adult', date_of_birth: '1990-01-01' }),
              makeChildMember({ id: 'minor', date_of_birth: '2018-01-01' }),
            ],
          }),
          assessments: {
            family: makeFamilyAssessment(
              {},
              { informalGuardianPreference: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreGuardian(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              family: { numberOfChildren: '0' },
            }),
          },
        }),
      ),
    ).toMatchObject({ points: 0, status: 'not_applicable' })

    expect(
      scoreGuardian(
        makeInput({
          assessments: {
            family: makeFamilyAssessment(
              {},
              {
                hasDependentRequiringGuardianship: 'yes',
                guardianDocumented: 'yes',
              },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    // DOB present without asOf → incomplete applicability
    expect(
      scoreGuardian(
        makeInput({
          asOf: undefined,
          household: makeHousehold({
            members: [makeChildMember({ date_of_birth: '2015-01-01' })],
          }),
        }),
      ).status,
    ).toBe('incomplete')

    // Conflicting DOB (adults) vs minor flag → incomplete; not unmet
    const conflictApplicability = scoreGuardian(
      makeInput({
        asOf: '2026-07-26T00:00:00.000Z',
        household: makeHousehold({
          members: [makeChildMember({ date_of_birth: '1990-01-01' })],
        }),
        assessments: {
          family: makeFamilyAssessment(
            {},
            { hasMinorChildren: 'yes', guardianDocumented: 'no' },
          ),
        },
      }),
    )
    expect(conflictApplicability.status).toBe('incomplete')
    expect(conflictApplicability.points).toBe(0)

    // Unknown applicability must not score as unmet
    expect(
      scoreGuardian(
        makeInput({
          assessments: {
            family: makeFamilyAssessment({
              family: { numberOfChildren: '2' },
              protection: { guardianDocumented: 'no' },
            }),
          },
        }),
      ).status,
    ).not.toBe('unmet')
  })
})

describe('Estate Organization & Legacy Instructions', () => {
  it('requires explicit instructions; legacyIntent alone does not score', () => {
    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { legacyIntent: 'strong' },
            }),
          },
        }),
      ).points,
    ).toBe(0)

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { legacyIntent: 'moderate' },
            }),
          },
        }),
      ).points,
    ).toBe(0)

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment(
              { estate: { legacyIntent: 'strong' } },
              { estateInformationOrganized: 'yes', finalWishesDocumented: 'yes' },
            ),
          },
        }),
      ),
    ).toMatchObject({ points: 2, status: 'met' })

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { digitalAssetInstructions: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { legacyLetterDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { businessSuccessionInstructions: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { hasWill: 'yes', legacyIntent: 'strong' },
            }),
          },
        }),
      ).points,
    ).toBe(0)

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({
              estate: { legacyIntent: 'weak' },
            }),
          },
        }),
      ).points,
    ).toBe(0)

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { hasLetterOfInstruction: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreOrg(
        makeInput({
          assessments: {
            retirement: makeRetirementAssessment({}, { funeralPreferencesDocumented: 'yes' }),
          },
        }),
      ),
    ).toMatchObject({ points: 1, status: 'partial' })

    expect(
      scoreOrg(
        makeInput({
          policies: [
            {
              id: 'p1',
              carrier: 'Acme',
              policy_type: 'Term Life',
              status: 'active',
              coverage_amount: 250000,
              renewal_or_review_date: null,
              beneficiary: 'Spouse',
            },
          ],
          assessments: {
            family: makeFamilyAssessment({}, { beneficiaryCount: '2' }),
          },
        }),
      ).points,
    ).toBe(0)

    expect(
      scoreOrg(
        makeInput({
          openTasks: [
            {
              id: 't1',
              title: 'Leave assets to family',
              due_date: null,
              priority: 'medium',
              status: 'open',
            },
          ],
        }),
      ).points,
    ).toBe(0)
  })
})

describe('Estate & Legacy category behavior', () => {
  it('returns insufficient_data for all incomplete or N/A-only', () => {
    expect(estateLegacyCalculator.calculate(makeInput()).progress.status).toBe(
      'insufficient_data',
    )

    const naOnly = estateLegacyCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            family: { numberOfChildren: '0' },
          }),
        },
      }),
    )
    expect(naOnly.progress.status).toBe('insufficient_data')
    expect(naOnly.progress.score).toBeNull()
    expect(
      naOnly.progress.evidence?.find((item) => item.criterion === 'Guardianship Planning'),
    ).toMatchObject({ status: 'not_applicable', earnedPoints: 0 })
    expect(naOnly.recommendations.every((item) => !item.actionKey.includes('guardianship'))).toBe(
      true,
    )
  })

  it('computes when N/A is paired with scorable evidence; N/A does not redistribute to 10', () => {
    const withNa = estateLegacyCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            family: { numberOfChildren: '0' },
            protection: { hasWill: 'yes', beneficiariesReviewed: 'yes', hasTrust: 'yes' },
          }),
          retirement: makeRetirementAssessment(
            {
              estate: {
                hasPowerOfAttorney: 'yes',
                legacyIntent: 'strong',
              },
            },
            {
              healthcareDirective: 'yes',
              estateInformationOrganized: 'yes',
              finalWishesDocumented: 'yes',
            },
          ),
        },
      }),
    )
    expect(withNa.progress.status).toBe('computed')
    // 4 docs + 2 review + 0 N/A + 2 org/legacy = 8 (no redistribution)
    expect(withNa.progress.score).toBe(8)
    expect(
      (withNa.progress.evidence ?? []).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(8)
    expect(withNa.recommendations.every((item) => !/trust/i.test(item.body))).toBe(true)

    const full = estateLegacyCalculator.calculate(
      makeInput({
        asOf: '2026-07-26T00:00:00.000Z',
        household: makeHousehold({
          members: [makeChildMember({ date_of_birth: '2015-01-01' })],
        }),
        assessments: {
          family: makeFamilyAssessment({
            protection: {
              hasWill: 'yes',
              hasTrust: 'yes',
              beneficiariesReviewed: 'yes',
              guardianDocumented: 'yes',
            },
          }),
          retirement: makeRetirementAssessment(
            {
              estate: { hasPowerOfAttorney: 'yes', legacyIntent: 'strong' },
            },
            {
              healthcareDirective: 'yes',
              estateInformationOrganized: 'yes',
              finalWishesDocumented: 'yes',
            },
          ),
        },
      }),
    )
    expect(full.progress.status).toBe('computed')
    expect(full.progress.score).toBe(10)
    expect(full.recommendations).toHaveLength(0)

    const unmet = estateLegacyCalculator.calculate(
      makeInput({
        assessments: {
          family: makeFamilyAssessment({
            family: { numberOfChildren: '0' },
            protection: { beneficiariesReviewed: 'no' },
          }),
        },
      }),
    )
    expect(unmet.progress.status).toBe('computed')
    expect(unmet.progress.score).toBe(0)
  })

  it('keeps conflicts isolated and recommendations deduped', () => {
    const signals = extractEstateLegacySignals(
      makeInput({
        asOf: '2026-07-26T00:00:00.000Z',
        household: makeHousehold({
          members: [makeChildMember({ date_of_birth: '2015-01-01' })],
        }),
        assessments: {
          family: makeFamilyAssessment({
            protection: { hasWill: 'yes', guardianDocumented: 'no' },
          }),
          retirement: makeRetirementAssessment({
            estate: { hasWill: 'no', hasPowerOfAttorney: 'yes' },
          }),
        },
      }),
    )
    const outcomes = scoreAllEstateLegacyCriteria(signals)
    const byId = Object.fromEntries(outcomes.map((item) => [item.id, item]))
    expect(byId.core_estate_documents.points).toBe(1)
    expect(byId.guardianship_planning.status).toBe('unmet')
    const summarized = summarizeEstateLegacyScore(outcomes)
    expect(summarized.status).toBe('computed')
    expect(
      toEstateLegacyEvidence(outcomes).reduce((sum, item) => sum + item.earnedPoints, 0),
    ).toBe(summarized.score)
    const recommendations = buildEstateLegacyRecommendations(outcomes, signals)
    const keys = recommendations.map((item) => item.actionKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(
      recommendations.every((item) => !/legally|probate-proof|guaranteed|trust/i.test(item.body)),
    ).toBe(true)
  })
})
