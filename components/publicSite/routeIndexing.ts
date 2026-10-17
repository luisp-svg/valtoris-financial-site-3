import { ROUTES } from '../../constants/routes'

/** Public entry pages remain discoverable; personal results and internal tools do not. */
export function shouldNoIndex(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return ['/crm', '/api', '/preview'].some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    || RESULT_PATHS.has(path)
}

const RESULT_PATHS = new Set<string>([
  ROUTES.reportCardResults, ROUTES.businessReportCardResults,
  ROUTES.retirementReportCardResults, ROUTES.studentLoanReportCardResults,
  ROUTES.creditReportCardResults, ROUTES.homeBuyerReportCardResults,
  ROUTES.protectionResults,
])

/** Standalone pages do not mount SiteHeader, which owns other public canonicals. */
export function standaloneCanonical(pathname: string, locale: 'en' | 'es'): string | null {
  const paths: readonly string[] = [
    ROUTES.schedule, ROUTES.familyAssessment, ROUTES.businessAssessment,
    ROUTES.retirementAssessment, ROUTES.studentLoanAssessment,
    ROUTES.creditAssessment, ROUTES.homeBuyerAssessment, ROUTES.protectionGap,
  ]
  if (!paths.includes(pathname)) return null
  return `https://www.valtorisfinancial.com${pathname}${locale === 'es' ? '?lang=es' : ''}`
}
