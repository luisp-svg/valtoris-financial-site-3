/**
 * Protection & Insurance criterion budgets (sum = 15).
 * Documented allocation for household-progress-v1 methodology.
 */
export const PROTECTION_CRITERION_MAX_POINTS = {
  life_insurance_adequacy: 8,
  disability_coverage: 2,
  critical_illness_coverage: 1,
  long_term_care_planning: 2,
  beneficiary_review: 2,
} as const

export type ProtectionCriterionId = keyof typeof PROTECTION_CRITERION_MAX_POINTS

export const PROTECTION_CRITERION_LABELS: Record<ProtectionCriterionId, string> = {
  life_insurance_adequacy: 'Life Insurance Adequacy',
  disability_coverage: 'Disability Coverage',
  critical_illness_coverage: 'Critical Illness Coverage',
  long_term_care_planning: 'Long-Term Care Planning',
  beneficiary_review: 'Beneficiary Review',
}

export const PROTECTION_CATEGORY_ID = 'protection_insurance' as const

/**
 * Centralized LTC planning applicability age.
 * Long-term care planning is evaluated once any relevant adult
 * (primary / spouse / partner) has reached this age.
 */
export const LTC_PLANNING_APPLICABILITY_AGE = 50

/** Member relationships treated as relevant adults for LTC applicability. */
export const LTC_RELEVANT_ADULT_RELATIONSHIPS = [
  'primary',
  'spouse',
  'partner',
] as const
