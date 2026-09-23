/** Existing AgentCRM source label for the Student Loan Report Card. */
export const STUDENT_LOAN_CONTACT_SOURCE = 'Student Loan Report Card'

/** Existing AgentCRM source label for the Credit Report Card. */
export const CREDIT_CONTACT_SOURCE = 'Credit Report Card'

/** Existing AgentCRM source label for the Home Buyer Report Card. */
export const HOME_BUYER_CONTACT_SOURCE = 'Home Buyer Report Card'

/** Existing AgentCRM source label for the Protection Gap. */
export const PROTECTION_CONTACT_SOURCE = 'Protection Gap'

/** Existing AgentCRM source label for the Business Report Card. */
export const BUSINESS_CONTACT_SOURCE = 'Business Report Card'

/** Existing AgentCRM source label for the Family Report Card. */
export const FAMILY_CONTACT_SOURCE = 'Family Report Card'

/** Existing AgentCRM source label for the Retirement Report Card. */
export const RETIREMENT_CONTACT_SOURCE = 'Retirement Report Card'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const STUDENT_LOAN_SERVICE_TAG = 'service-student-loans'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const CREDIT_SERVICE_TAG = 'service-credit-improvement'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const HOME_BUYER_SERVICE_TAG = 'service-home-buyer-readiness'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const PROTECTION_SERVICE_TAG = 'service-life-insurance'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const BUSINESS_SERVICE_TAG = 'service-business-planning'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const FAMILY_SERVICE_TAG = 'service-family-planning'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const RETIREMENT_SERVICE_TAG = 'service-retirement-planning'

export type ReportCardAgentCrmConfig =
  | {
      assessmentType: 'student_loan'
      source: typeof STUDENT_LOAN_CONTACT_SOURCE
      serviceTag: typeof STUDENT_LOAN_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'credit'
      source: typeof CREDIT_CONTACT_SOURCE
      serviceTag: typeof CREDIT_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'home_buyer'
      source: typeof HOME_BUYER_CONTACT_SOURCE
      serviceTag: typeof HOME_BUYER_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'protection'
      source: typeof PROTECTION_CONTACT_SOURCE
      serviceTag: typeof PROTECTION_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'business'
      source: typeof BUSINESS_CONTACT_SOURCE
      serviceTag: typeof BUSINESS_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'family'
      source: typeof FAMILY_CONTACT_SOURCE
      serviceTag: typeof FAMILY_SERVICE_TAG
      enabled: boolean
    }
  | {
      assessmentType: 'retirement'
      source: typeof RETIREMENT_CONTACT_SOURCE
      serviceTag: typeof RETIREMENT_SERVICE_TAG
      enabled: boolean
    }

const STUDENT_LOAN_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'student_loan',
  source: STUDENT_LOAN_CONTACT_SOURCE,
  serviceTag: STUDENT_LOAN_SERVICE_TAG,
  enabled: true,
}

const CREDIT_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'credit',
  source: CREDIT_CONTACT_SOURCE,
  serviceTag: CREDIT_SERVICE_TAG,
  enabled: true,
}

const HOME_BUYER_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'home_buyer',
  source: HOME_BUYER_CONTACT_SOURCE,
  serviceTag: HOME_BUYER_SERVICE_TAG,
  enabled: true,
}

const PROTECTION_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'protection',
  source: PROTECTION_CONTACT_SOURCE,
  serviceTag: PROTECTION_SERVICE_TAG,
  enabled: true,
}

const BUSINESS_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'business',
  source: BUSINESS_CONTACT_SOURCE,
  serviceTag: BUSINESS_SERVICE_TAG,
  enabled: true,
}

const FAMILY_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'family',
  source: FAMILY_CONTACT_SOURCE,
  serviceTag: FAMILY_SERVICE_TAG,
  enabled: true,
}

const RETIREMENT_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'retirement',
  source: RETIREMENT_CONTACT_SOURCE,
  serviceTag: RETIREMENT_SERVICE_TAG,
  enabled: true,
}

const ENABLED_CONFIGS: Record<string, ReportCardAgentCrmConfig> = {
  student_loan: STUDENT_LOAN_CONFIG,
  credit: CREDIT_CONFIG,
  home_buyer: HOME_BUYER_CONFIG,
  protection: PROTECTION_CONFIG,
  business: BUSINESS_CONFIG,
  family: FAMILY_CONFIG,
  retirement: RETIREMENT_CONFIG,
}

/** Returns the sync configuration for an enabled Report Card. Every other type stays inactive. */
export function getReportCardAgentCrmConfig(assessmentType: string): ReportCardAgentCrmConfig | null {
  const config = ENABLED_CONFIGS[assessmentType]
  if (!config?.enabled) return null
  return config
}

export function isEnabledReportCardContactSource(source: string): boolean {
  return Object.values(ENABLED_CONFIGS).some((config) => config.enabled && config.source === source)
}

export function isEnabledReportCardServiceTag(serviceTag: string): boolean {
  return Object.values(ENABLED_CONFIGS).some((config) => config.enabled && config.serviceTag === serviceTag)
}
