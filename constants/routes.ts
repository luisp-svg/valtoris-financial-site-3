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
  /** Durable public advisor card by opaque key (QR/NFC-safe). */
  publicCardByKey: '/c/k/:key',
  /** Human-readable public advisor card slug. */
  publicCardBySlug: '/c/:slug',
  crm: '/crm',
  crmLogin: '/crm/login',
  /** Invite + password-recovery landing (public CRM auth). */
  crmAuthRecovery: '/crm/auth/recovery',
  crmLeads: '/crm/leads',
  crmIntake: '/crm/intake',
  crmContacts: '/crm/contacts',
  crmHouseholds: '/crm/households',
  crmPipeline: '/crm/pipeline',
  crmOpportunities: '/crm/opportunities',
  crmTasks: '/crm/tasks',
  crmAppointments: '/crm/appointments',
  crmPolicies: '/crm/policies',
  /** Life / IUL / FIA production applications queue (P1B). */
  crmProduction: '/crm/production',
  /** Owner-only carrier and product catalog (P1B-2A). */
  crmProductionCatalog: '/crm/production/catalog',
  /** New Life / IUL / FIA production application (P1B-2B). */
  crmProductionNew: '/crm/production/new',
  /** Edit / complete a recoverable production application (P1B-2C). */
  crmProductionEdit: '/crm/production/:applicationId/edit',
  crmAnnualReviews: '/crm/annual-reviews',
  crmDocuments: '/crm/documents',
  crmCampaigns: '/crm/campaigns',
  crmSettings: '/crm/settings',
} as const

export function crmHouseholdPath(householdId: string): string {
  return `${ROUTES.crmHouseholds}/${householdId}`
}

export function crmContactPath(leadId: string): string {
  return `${ROUTES.crmContacts}/${leadId}`
}

export function crmContactNewPath(): string {
  return `${ROUTES.crmContacts}/new`
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

export function crmProductionPath(applicationId: string): string {
  return `${ROUTES.crmProduction}/${applicationId}`
}

export function crmProductionCatalogPath(): string {
  return ROUTES.crmProductionCatalog
}

export function crmProductionNewPath(): string {
  return ROUTES.crmProductionNew
}

export function crmProductionEditPath(applicationId: string): string {
  return `${ROUTES.crmProduction}/${applicationId}/edit`
}

/** Public advisor card path by durable public key. */
export function publicCardKeyPath(publicKey: string): string {
  return `/c/k/${publicKey}`
}

/** Public advisor card path by human-readable slug. */
export function publicCardSlugPath(slug: string): string {
  return `/c/${slug}`
}
