import { ROUTES } from '../../../constants/routes'
import type { SolutionsCopyKey } from './copy'

export const SOLUTIONS_DIAGNOSTICS_ID = 'solutions-diagnostics'
export const SOLUTIONS_DIAGNOSTICS_HASH = `${ROUTES.solutions}#${SOLUTIONS_DIAGNOSTICS_ID}`

export type SolutionsCardItem = {
  readonly id: string
  readonly to: string
  readonly titleKey: SolutionsCopyKey
  readonly bodyKey: SolutionsCopyKey
  readonly ctaKey: SolutionsCopyKey
}

export const SOLUTIONS_FAMILY_CARDS: readonly SolutionsCardItem[] = [
  {
    id: 'protection',
    to: ROUTES.protectionAnalysis,
    titleKey: 'familyProtectionTitle',
    bodyKey: 'familyProtectionBody',
    ctaKey: 'familyProtectionCta',
  },
  {
    id: 'insurance',
    to: ROUTES.insurance,
    titleKey: 'familyInsuranceTitle',
    bodyKey: 'familyInsuranceBody',
    ctaKey: 'familyInsuranceCta',
  },
  {
    id: 'health',
    to: ROUTES.healthDisability,
    titleKey: 'familyHealthTitle',
    bodyKey: 'familyHealthBody',
    ctaKey: 'familyHealthCta',
  },
  {
    id: 'credit',
    to: ROUTES.credit,
    titleKey: 'familyCreditTitle',
    bodyKey: 'familyCreditBody',
    ctaKey: 'familyCreditCta',
  },
  {
    id: 'studentLoans',
    to: ROUTES.studentLoans,
    titleKey: 'familyStudentTitle',
    bodyKey: 'familyStudentBody',
    ctaKey: 'familyStudentCta',
  },
  {
    id: 'estate',
    to: ROUTES.estateLegacy,
    titleKey: 'familyEstateTitle',
    bodyKey: 'familyEstateBody',
    ctaKey: 'familyEstateCta',
  },
  {
    id: 'tax',
    to: ROUTES.taxStrategy,
    titleKey: 'familyTaxTitle',
    bodyKey: 'familyTaxBody',
    ctaKey: 'familyTaxCta',
  },
]

export const SOLUTIONS_BUSINESS_CARDS: readonly SolutionsCardItem[] = [
  {
    id: 'formation',
    to: ROUTES.businessFormation,
    titleKey: 'businessFormationTitle',
    bodyKey: 'businessFormationBody',
    ctaKey: 'businessFormationCta',
  },
  {
    id: 'insurance',
    to: ROUTES.insurance,
    titleKey: 'businessInsuranceTitle',
    bodyKey: 'businessInsuranceBody',
    ctaKey: 'businessInsuranceCta',
  },
  {
    id: 'tax',
    to: ROUTES.taxStrategy,
    titleKey: 'businessTaxTitle',
    bodyKey: 'businessTaxBody',
    ctaKey: 'businessTaxCta',
  },
  {
    id: 'estate',
    to: ROUTES.estateLegacy,
    titleKey: 'businessEstateTitle',
    bodyKey: 'businessEstateBody',
    ctaKey: 'businessEstateCta',
  },
  {
    id: 'credit',
    to: ROUTES.credit,
    titleKey: 'businessCreditTitle',
    bodyKey: 'businessCreditBody',
    ctaKey: 'businessCreditCta',
  },
]

export const SOLUTIONS_TOOL_CARDS: readonly SolutionsCardItem[] = [
  {
    id: 'family',
    to: ROUTES.reportCard,
    titleKey: 'toolFamilyTitle',
    bodyKey: 'toolFamilyBody',
    ctaKey: 'toolFamilyCta',
  },
  {
    id: 'business',
    to: ROUTES.businessReportCard,
    titleKey: 'toolBusinessTitle',
    bodyKey: 'toolBusinessBody',
    ctaKey: 'toolBusinessCta',
  },
  {
    id: 'retirement',
    to: ROUTES.retirementReportCard,
    titleKey: 'toolRetirementTitle',
    bodyKey: 'toolRetirementBody',
    ctaKey: 'toolRetirementCta',
  },
  {
    id: 'protection',
    to: ROUTES.protectionAnalysis,
    titleKey: 'toolProtectionTitle',
    bodyKey: 'toolProtectionBody',
    ctaKey: 'toolProtectionCta',
  },
  {
    id: 'studentLoan',
    to: ROUTES.studentLoanReportCard,
    titleKey: 'toolStudentTitle',
    bodyKey: 'toolStudentBody',
    ctaKey: 'toolStudentCta',
  },
  {
    id: 'credit',
    to: ROUTES.creditReportCard,
    titleKey: 'toolCreditTitle',
    bodyKey: 'toolCreditBody',
    ctaKey: 'toolCreditCta',
  },
]
