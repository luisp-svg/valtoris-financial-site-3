export const ROUTES = {
  home: '/',
  solutions: '/solutions',
  reportCard: '/report-card',
  familyAssessment: '/family-assessment',
  reportCardResults: '/results',
  protectionAnalysis: '/protection-analysis',
  protectionGap: '/protection-gap',
  protectionResults: '/protection-results',
  businessReportCard: '/business-report-card',
  businessAssessment: '/business-assessment',
  businessReportCardResults: '/business-results',
  retirementReportCard: '/retirement-report-card',
  retirementAssessment: '/retirement-assessment',
  retirementReportCardResults: '/retirement-results',
  checkup: '/checkup',
  schedule: '/schedule',
  privacy: '/privacy',
  crm: '/crm',
  crmLogin: '/crm/login',
  crmLeads: '/crm/leads',
  crmIntake: '/crm/intake',
  crmHouseholds: '/crm/households',
  crmPipeline: '/crm/pipeline',
  crmOpportunities: '/crm/opportunities',
  crmTasks: '/crm/tasks',
  crmAppointments: '/crm/appointments',
  crmPolicies: '/crm/policies',
  crmAnnualReviews: '/crm/annual-reviews',
  crmDocuments: '/crm/documents',
  crmSettings: '/crm/settings',
} as const

export function crmHouseholdPath(householdId: string): string {
  return `${ROUTES.crmHouseholds}/${householdId}`
}

/**
 * Household assessment history (Initial Financial Diagnostic and future types).
 */
export function crmHouseholdAssessmentsPath(householdId: string): string {
  return `${crmHouseholdPath(householdId)}/assessments`
}

/**
 * Detail for one household assessment (public Family diagnostic in Phase 5).
 */
export function crmHouseholdAssessmentDetailPath(
  householdId: string,
  assessmentId: string,
): string {
  return `${crmHouseholdAssessmentsPath(householdId)}/${assessmentId}`
}

/**
 * Household Onboarding route. Optional section becomes `?section=`.
 * Invalid sections are normalized by the onboarding page.
 */
export function crmHouseholdOnboardingPath(
  householdId: string,
  section?: string,
): string {
  const base = `${crmHouseholdPath(householdId)}/onboarding`
  if (!section) return base
  const params = new URLSearchParams()
  params.set('section', section)
  return `${base}?${params.toString()}`
}

export function crmOpportunityPath(opportunityId: string): string {
  return `${ROUTES.crmOpportunities}/${opportunityId}`
}
