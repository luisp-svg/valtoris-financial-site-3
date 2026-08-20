/**
 * Shared public Report Card ingest catalog.
 * One allowlisted assessment_type ↔ lead_type contract for CRM ingest + Intake.
 * Safe for browser and server imports (no I/O).
 */

export const PUBLIC_REPORT_CARD_ASSESSMENT_TYPES = [
  'family',
  'business',
  'retirement',
  'protection',
] as const

export type PublicReportCardAssessmentType = (typeof PUBLIC_REPORT_CARD_ASSESSMENT_TYPES)[number]

export const PUBLIC_REPORT_CARD_LEAD_TYPES = [
  'Family Report Card',
  'Business Report Card',
  'Retirement Report Card',
  'Protection Gap',
] as const

export type PublicReportCardLeadType = (typeof PUBLIC_REPORT_CARD_LEAD_TYPES)[number]

export const LEAD_TYPE_BY_ASSESSMENT = {
  family: 'Family Report Card',
  business: 'Business Report Card',
  retirement: 'Retirement Report Card',
  protection: 'Protection Gap',
} as const satisfies Record<PublicReportCardAssessmentType, PublicReportCardLeadType>

export const HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT = {
  family: 'family_report_card',
  business: 'business_report_card',
  retirement: 'retirement_report_card',
  protection: 'protection_gap',
} as const satisfies Record<PublicReportCardAssessmentType, string>

export const REPORT_PATH_BY_ASSESSMENT = {
  family: '/results',
  business: '/business-results',
  retirement: '/retirement-results',
  protection: '/protection-results',
} as const satisfies Record<PublicReportCardAssessmentType, string>

/** CRM display labels. Family keeps the established Initial Financial Diagnostic name. */
export const CRM_PRODUCT_LABEL_BY_ASSESSMENT = {
  family: 'Initial Financial Diagnostic',
  business: 'Business Report Card',
  retirement: 'Retirement Report Card',
  protection: 'Protection Gap',
} as const satisfies Record<PublicReportCardAssessmentType, string>

export const PUBLIC_REPORT_CARD_SCORING_VERSION = {
  family: 1,
  business: 1,
  retirement: 1,
  protection: 1,
} as const satisfies Record<PublicReportCardAssessmentType, number>

export const PUBLIC_REPORT_CARD_ASSESSMENT_VERSION = 1

export function isPublicReportCardAssessmentType(
  value: unknown,
): value is PublicReportCardAssessmentType {
  return (
    value === 'family' ||
    value === 'business' ||
    value === 'retirement' ||
    value === 'protection'
  )
}

export function leadTypeForAssessment(
  assessmentType: PublicReportCardAssessmentType,
): PublicReportCardLeadType {
  return LEAD_TYPE_BY_ASSESSMENT[assessmentType]
}

export function crmProductLabelForAssessment(
  assessmentType: PublicReportCardAssessmentType,
): string {
  return CRM_PRODUCT_LABEL_BY_ASSESSMENT[assessmentType]
}

export function crmProductLabelForLeadType(leadType: string): string {
  if (leadType === 'Family Report Card') return CRM_PRODUCT_LABEL_BY_ASSESSMENT.family
  if (leadType === 'Business Report Card') return CRM_PRODUCT_LABEL_BY_ASSESSMENT.business
  if (leadType === 'Retirement Report Card') return CRM_PRODUCT_LABEL_BY_ASSESSMENT.retirement
  if (leadType === 'Protection Gap') return CRM_PRODUCT_LABEL_BY_ASSESSMENT.protection
  return leadType
}

export function assessmentTypeForLeadType(
  leadType: string,
): PublicReportCardAssessmentType | null {
  if (leadType === 'Family Report Card') return 'family'
  if (leadType === 'Business Report Card') return 'business'
  if (leadType === 'Retirement Report Card') return 'retirement'
  if (leadType === 'Protection Gap') return 'protection'
  return null
}
