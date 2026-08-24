/**
 * App-side product identity for specialized public assessments.
 * Public CRM ingest allowlist lives in publicIngestCatalog.ts.
 */

export const SPECIALIZED_ASSESSMENT_PRODUCTS = ['student_loan', 'credit'] as const

export type SpecializedAssessmentProduct = (typeof SPECIALIZED_ASSESSMENT_PRODUCTS)[number]

export const STUDENT_LOAN_ASSESSMENT_TYPE = 'student_loan' as const
export const CREDIT_ASSESSMENT_TYPE = 'credit' as const

export function isSpecializedAssessmentProduct(
  value: unknown,
): value is SpecializedAssessmentProduct {
  return value === 'student_loan' || value === 'credit'
}
