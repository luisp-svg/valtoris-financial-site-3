import { ROUTES } from '../../constants/routes'
import type { ChromeCopyKey } from './chromeCopy'

/**
 * Phase 1 public navigation.
 * Service destinations use real pages where they exist.
 * About children stay empty until /about, /about/process, and /about/team exist.
 */

export type PublicNavLink = {
  readonly id: string
  readonly to: string
  readonly labelKey: ChromeCopyKey
}

export type PublicNavGroup = {
  readonly id: string
  readonly headingKey: ChromeCopyKey
  readonly links: readonly PublicNavLink[]
}

export const SERVICES_NAV_GROUPS: readonly PublicNavGroup[] = [
  {
    id: 'individuals',
    headingKey: 'servicesGroupIndividuals',
    links: [
      { id: 'protection', to: ROUTES.protectionAnalysis, labelKey: 'servicesProtection' },
      { id: 'retirement', to: ROUTES.retirementReportCard, labelKey: 'servicesRetirement' },
      { id: 'insurance', to: ROUTES.insurance, labelKey: 'servicesInsurance' },
      { id: 'health', to: ROUTES.healthDisability, labelKey: 'servicesHealth' },
      { id: 'credit', to: ROUTES.credit, labelKey: 'servicesCredit' },
      { id: 'studentLoans', to: ROUTES.studentLoans, labelKey: 'servicesStudentLoans' },
      { id: 'estate', to: ROUTES.estateLegacy, labelKey: 'servicesEstate' },
    ],
  },
  {
    id: 'business',
    headingKey: 'servicesGroupBusiness',
    links: [
      { id: 'businessFormation', to: ROUTES.businessFormation, labelKey: 'servicesBusinessFormation' },
      { id: 'tax', to: ROUTES.taxStrategy, labelKey: 'servicesTax' },
      { id: 'viewSolutions', to: ROUTES.solutions, labelKey: 'servicesViewSolutions' },
    ],
  },
]

export const SERVICES_NAV_LINKS: readonly PublicNavLink[] = SERVICES_NAV_GROUPS.flatMap(
  (group) => group.links,
)

export const TOOLS_NAV_LINKS: readonly PublicNavLink[] = [
  { id: 'family', to: ROUTES.reportCard, labelKey: 'toolsFamily' },
  { id: 'business', to: ROUTES.businessReportCard, labelKey: 'toolsBusiness' },
  { id: 'retirement', to: ROUTES.retirementReportCard, labelKey: 'toolsRetirement' },
  { id: 'protection', to: ROUTES.protectionAnalysis, labelKey: 'toolsProtection' },
  { id: 'studentLoan', to: ROUTES.studentLoanReportCard, labelKey: 'toolsStudentLoan' },
  { id: 'credit', to: ROUTES.creditReportCard, labelKey: 'toolsCredit' },
]

export const HOME_NAV: PublicNavLink = {
  id: 'home',
  to: ROUTES.home,
  labelKey: 'navHome',
}

/** Reserved for future About / Process / Team pages. Empty until those routes exist. */
export const ABOUT_NAV_LINKS: readonly PublicNavLink[] = []

/**
 * Reserved until a real /contact page exists.
 * Not rendered in primary header or mobile nav because it currently
 * duplicates Book a Meeting → /schedule. Footer Company still uses this.
 */
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
  { id: 'home', to: ROUTES.home, labelKey: 'navHome' },
  { id: 'book', to: ROUTES.schedule, labelKey: 'bookMeeting' },
  { id: 'privacy', to: ROUTES.privacy, labelKey: 'footerPrivacy' },
  { id: 'advisorLogin', to: ROUTES.crmLogin, labelKey: 'advisorLogin' },
]

export const FAMILIES_FOOTER_LINKS: readonly PublicNavLink[] = [
  { id: 'insurance', to: ROUTES.insurance, labelKey: 'servicesInsurance' },
  { id: 'health', to: ROUTES.healthDisability, labelKey: 'servicesHealth' },
  { id: 'estate', to: ROUTES.estateLegacy, labelKey: 'servicesEstate' },
  { id: 'studentLoans', to: ROUTES.studentLoans, labelKey: 'servicesStudentLoans' },
  { id: 'credit', to: ROUTES.credit, labelKey: 'servicesCredit' },
  { id: 'explore', to: ROUTES.solutions, labelKey: 'exploreAllSolutions' },
]

export const BUSINESS_FOOTER_LINKS: readonly PublicNavLink[] = [
  { id: 'businessFormation', to: ROUTES.businessFormation, labelKey: 'servicesBusinessFormation' },
  { id: 'tax', to: ROUTES.taxStrategy, labelKey: 'servicesTax' },
  { id: 'insurance', to: ROUTES.insurance, labelKey: 'servicesInsurance' },
  { id: 'explore', to: ROUTES.solutions, labelKey: 'exploreAllSolutions' },
]

/** Top-level visible peers. About and Contact are omitted until they have unique destinations. */
export const VISIBLE_TOP_LEVEL_NAV_IDS = ['home', 'services', 'tools'] as const

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
