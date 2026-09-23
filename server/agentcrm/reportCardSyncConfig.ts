/** Existing AgentCRM source label. This phase enables Student Loan only. */
export const STUDENT_LOAN_CONTACT_SOURCE = 'Student Loan Report Card'

/** Existing AgentCRM tag. This module does not create a tag definition. */
export const STUDENT_LOAN_SERVICE_TAG = 'service-student-loans'

export type ReportCardAgentCrmConfig = {
  assessmentType: 'student_loan'
  source: typeof STUDENT_LOAN_CONTACT_SOURCE
  serviceTag: typeof STUDENT_LOAN_SERVICE_TAG
  enabled: boolean
}

const STUDENT_LOAN_CONFIG: ReportCardAgentCrmConfig = {
  assessmentType: 'student_loan',
  source: STUDENT_LOAN_CONTACT_SOURCE,
  serviceTag: STUDENT_LOAN_SERVICE_TAG,
  enabled: true,
}

const ENABLED_CONFIGS: Record<string, ReportCardAgentCrmConfig> = {
  student_loan: STUDENT_LOAN_CONFIG,
}

/** Returns the sync configuration for an enabled Report Card. Every other type stays inactive. */
export function getReportCardAgentCrmConfig(assessmentType: string): ReportCardAgentCrmConfig | null {
  const config = ENABLED_CONFIGS[assessmentType]
  if (!config?.enabled) return null
  return config
}

export function isEnabledReportCardContactSource(source: string): boolean {
  return source === STUDENT_LOAN_CONTACT_SOURCE
}

export function isEnabledReportCardServiceTag(serviceTag: string): boolean {
  return serviceTag === STUDENT_LOAN_SERVICE_TAG
}
