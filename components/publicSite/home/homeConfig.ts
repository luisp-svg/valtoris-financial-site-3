import { ROUTES } from '../../../constants/routes'
import type { HomeCopy } from './copy'

export type HomeCopyKey = keyof HomeCopy

export type HomeLinkItem = {
  readonly id: string
  readonly to: string
  readonly titleKey: HomeCopyKey
  readonly bodyKey?: HomeCopyKey
  readonly ctaKey?: HomeCopyKey
}

export const HOME_DIAGNOSTICS_HASH = '/#home-diagnostics'

export const HOME_AUDIENCE_PATHS: readonly HomeLinkItem[] = [
  {
    id: 'families',
    to: ROUTES.solutions,
    titleKey: 'audienceFamiliesTitle',
    bodyKey: 'audienceFamiliesBody',
    ctaKey: 'audienceFamiliesCta',
  },
  {
    id: 'business',
    to: ROUTES.solutions,
    titleKey: 'audienceBusinessTitle',
    bodyKey: 'audienceBusinessBody',
    ctaKey: 'audienceBusinessCta',
  },
  {
    id: 'studentLoans',
    to: ROUTES.studentLoanReportCard,
    titleKey: 'audienceStudentTitle',
    bodyKey: 'audienceStudentBody',
    ctaKey: 'audienceStudentCta',
  },
  {
    id: 'credit',
    to: ROUTES.creditReportCard,
    titleKey: 'audienceCreditTitle',
    bodyKey: 'audienceCreditBody',
    ctaKey: 'audienceCreditCta',
  },
]

export const HOME_SERVICE_CARDS: readonly HomeLinkItem[] = [
  {
    id: 'protection',
    to: ROUTES.protectionAnalysis,
    titleKey: 'serviceProtectionTitle',
    bodyKey: 'serviceProtectionBody',
  },
  {
    id: 'retirement',
    to: ROUTES.retirementReportCard,
    titleKey: 'serviceRetirementTitle',
    bodyKey: 'serviceRetirementBody',
  },
  {
    id: 'credit',
    to: ROUTES.creditReportCard,
    titleKey: 'serviceCreditTitle',
    bodyKey: 'serviceCreditBody',
  },
  {
    id: 'studentLoans',
    to: ROUTES.studentLoanReportCard,
    titleKey: 'serviceStudentTitle',
    bodyKey: 'serviceStudentBody',
  },
  {
    id: 'business',
    to: ROUTES.solutions,
    titleKey: 'serviceBusinessTitle',
    bodyKey: 'serviceBusinessBody',
  },
  {
    id: 'insurance',
    to: ROUTES.solutions,
    titleKey: 'serviceInsuranceTitle',
    bodyKey: 'serviceInsuranceBody',
  },
  {
    id: 'estate',
    to: ROUTES.solutions,
    titleKey: 'serviceEstateTitle',
    bodyKey: 'serviceEstateBody',
  },
  {
    id: 'tax',
    to: ROUTES.solutions,
    titleKey: 'serviceTaxTitle',
    bodyKey: 'serviceTaxBody',
  },
]

export const HOME_FEATURED_DIAGNOSTICS: readonly HomeLinkItem[] = [
  {
    id: 'family',
    to: ROUTES.reportCard,
    titleKey: 'diagnosticsFamilyTitle',
    bodyKey: 'diagnosticsFamilyBody',
  },
  {
    id: 'business',
    to: ROUTES.businessReportCard,
    titleKey: 'diagnosticsBusinessTitle',
    bodyKey: 'diagnosticsBusinessBody',
  },
  {
    id: 'studentLoan',
    to: ROUTES.studentLoanReportCard,
    titleKey: 'diagnosticsStudentTitle',
    bodyKey: 'diagnosticsStudentBody',
  },
  {
    id: 'credit',
    to: ROUTES.creditReportCard,
    titleKey: 'diagnosticsCreditTitle',
    bodyKey: 'diagnosticsCreditBody',
  },
]

export const HOME_MORE_DIAGNOSTICS: readonly HomeLinkItem[] = [
  { id: 'retirement', to: ROUTES.retirementReportCard, titleKey: 'diagnosticsRetirement' },
  { id: 'protection', to: ROUTES.protectionAnalysis, titleKey: 'diagnosticsProtection' },
]
