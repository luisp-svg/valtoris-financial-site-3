import { ROUTES } from '../../constants/routes'
import type { ChromeCopyKey } from './chromeCopy'

/**
 * Phase 1 public navigation.
 * Destinations are existing routes only — no placeholder service pages.
 * About children stay empty until /about, /about/process, and /about/team exist.
 */

export type PublicNavLink = {
  readonly id: string
  readonly to: string
  readonly labelKey: ChromeCopyKey
}

export const SERVICES_NAV_LINKS: readonly PublicNavLink[] = [
  { id: 'families', to: ROUTES.solutions, labelKey: 'servicesFamilies' },
  { id: 'business', to: ROUTES.solutions, labelKey: 'servicesBusiness' },
  { id: 'protection', to: ROUTES.protectionAnalysis, labelKey: 'servicesProtection' },
  { id: 'retirement', to: ROUTES.retirementReportCard, labelKey: 'servicesRetirement' },
  { id: 'credit', to: ROUTES.creditReportCard, labelKey: 'servicesCredit' },
  { id: 'studentLoans', to: ROUTES.studentLoanReportCard, labelKey: 'servicesStudentLoans' },
  { id: 'viewSolutions', to: ROUTES.solutions, labelKey: 'servicesViewSolutions' },
]

export const TOOLS_NAV_LINKS: readonly PublicNavLink[] = [
  { id: 'family', to: ROUTES.reportCard, labelKey: 'toolsFamily' },
  { id: 'business', to: ROUTES.businessReportCard, labelKey: 'toolsBusiness' },
  { id: 'retirement', to: ROUTES.retirementReportCard, labelKey: 'toolsRetirement' },
  { id: 'protection', to: ROUTES.protectionAnalysis, labelKey: 'toolsProtection' },
  { id: 'studentLoan', to: ROUTES.studentLoanReportCard, labelKey: 'toolsStudentLoan' },
  { id: 'credit', to: ROUTES.creditReportCard, labelKey: 'toolsCredit' },
]

/** Reserved for future About / Process / Team pages. Empty until those routes exist. */
export const ABOUT_NAV_LINKS: readonly PublicNavLink[] = []

export const CONTACT_NAV: PublicNavLink = {
  id: 'contact',
  to: ROUTES.schedule,
  labelKey: 'navContact',
}

export const BOOK_NAV: PublicNavLink = {
  id: 'book',
  to: ROUTES.schedule,
  labelKey: 'bookMeeting',
}

export const COMPANY_FOOTER_LINKS: readonly PublicNavLink[] = [
  { id: 'contact', to: ROUTES.schedule, labelKey: 'navContact' },
  { id: 'privacy', to: ROUTES.privacy, labelKey: 'footerPrivacy' },
  { id: 'advisorLogin', to: ROUTES.crmLogin, labelKey: 'advisorLogin' },
]

export const FAMILIES_FOOTER_LINKS: readonly PublicNavLink[] = [
  { id: 'families', to: ROUTES.solutions, labelKey: 'servicesFamilies' },
  { id: 'protection', to: ROUTES.protectionAnalysis, labelKey: 'servicesProtection' },
  { id: 'retirement', to: ROUTES.retirementReportCard, labelKey: 'servicesRetirement' },
  { id: 'credit', to: ROUTES.creditReportCard, labelKey: 'servicesCredit' },
  { id: 'studentLoans', to: ROUTES.studentLoanReportCard, labelKey: 'servicesStudentLoans' },
]

export const BUSINESS_FOOTER_LINKS: readonly PublicNavLink[] = [
  { id: 'businessOwners', to: ROUTES.solutions, labelKey: 'servicesBusiness' },
  { id: 'businessReportCard', to: ROUTES.businessReportCard, labelKey: 'toolsBusiness' },
]

/** Top-level visible peers. About is omitted until it has a safe destination. */
export const VISIBLE_TOP_LEVEL_NAV_IDS = ['services', 'tools', 'contact'] as const

export const FUTURE_UNBUILT_PUBLIC_PATHS = [
  '/services',
  '/services/families',
  '/services/business',
  '/services/protection',
  '/services/retirement',
  '/services/credit',
  '/services/student-loans',
  '/tools',
  '/about',
  '/about/process',
  '/about/team',
  '/contact',
  '/terms',
] as const
