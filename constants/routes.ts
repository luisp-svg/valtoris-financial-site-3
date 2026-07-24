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
  crm: '/crm',
  crmLogin: '/crm/login',
  crmLeads: '/crm/leads',
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

export function crmOpportunityPath(opportunityId: string): string {
  return `${ROUTES.crmOpportunities}/${opportunityId}`
}
