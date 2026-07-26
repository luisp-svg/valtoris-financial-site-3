/**
 * Estate & Legacy criterion budgets (sum = 10).
 *
 * 1. Core Estate Documents ...................... 4
 * 2. Beneficiary & Ownership Review ............. 2
 * 3. Guardianship Planning ...................... 2
 * 4. Estate Organization & Legacy Instructions .. 2
 */
export const ESTATE_LEGACY_CRITERION_MAX_POINTS = {
  core_estate_documents: 4,
  beneficiary_ownership_review: 2,
  guardianship_planning: 2,
  estate_organization_legacy_instructions: 2,
} as const

export type EstateLegacyCriterionId = keyof typeof ESTATE_LEGACY_CRITERION_MAX_POINTS

export const ESTATE_LEGACY_CRITERION_LABELS: Record<EstateLegacyCriterionId, string> = {
  core_estate_documents: 'Core Estate Documents',
  beneficiary_ownership_review: 'Beneficiary & Ownership Review',
  guardianship_planning: 'Guardianship Planning',
  estate_organization_legacy_instructions: 'Estate Organization & Legacy Instructions',
}

export const ESTATE_LEGACY_CATEGORY_ID = 'estate_legacy' as const

/**
 * Beneficiary/ownership review is "current" when an authoritative review date
 * is within this many months of the injectable reference date (`input.asOf`).
 */
export const BENEFICIARY_REVIEW_CURRENT_MONTHS = 24

/** Age under which a household member is treated as a minor for guardianship. */
export const MINOR_AGE_THRESHOLD = 18

export type CoreDocumentId = 'will' | 'financial_poa' | 'healthcare_directive' | 'trust'

/**
 * Scored core-document point allocation (sum = 4).
 * Trust is extracted for evidence only and is never required for full credit.
 */
export const CORE_DOCUMENT_POINTS: Record<
  Exclude<CoreDocumentId, 'trust'>,
  number
> = {
  will: 2,
  financial_poa: 1,
  healthcare_directive: 1,
}

/** Document ids that contribute to the Core Estate Documents score. */
export const SCORED_CORE_DOCUMENT_IDS = [
  'will',
  'financial_poa',
  'healthcare_directive',
] as const satisfies ReadonlyArray<Exclude<CoreDocumentId, 'trust'>>

export const CORE_DOCUMENT_LABELS: Record<CoreDocumentId, string> = {
  will: 'Will',
  financial_poa: 'Financial Power of Attorney',
  healthcare_directive: 'Healthcare Directive / Medical POA',
  trust: 'Trust',
}

/**
 * Normalized document aliases → core document id.
 * Equivalent aliases for the same document count once.
 */
export const CORE_DOCUMENT_ALIASES: Record<string, CoreDocumentId> = {
  will: 'will',
  haswill: 'will',
  willcompleted: 'will',
  lastwill: 'will',
  lastwillandtestament: 'will',
  financialpowerofattorney: 'financial_poa',
  durablepowerofattorney: 'financial_poa',
  financialpoa: 'financial_poa',
  durablepoa: 'financial_poa',
  powerofattorney: 'financial_poa',
  haspowerofattorney: 'financial_poa',
  healthcaredirective: 'healthcare_directive',
  medicalpowerofattorney: 'healthcare_directive',
  medicalpoa: 'healthcare_directive',
  advancedirective: 'healthcare_directive',
  livingwill: 'healthcare_directive',
  healthcareproxy: 'healthcare_directive',
  trust: 'trust',
  hastrust: 'trust',
  revocabletrust: 'trust',
  livingtrust: 'trust',
  irrevocabletrust: 'trust',
}

/** Relationships that may indicate guardianship-dependent members. */
export const GUARDIANSHIP_DEPENDENT_RELATIONSHIPS = ['child', 'dependent'] as const
