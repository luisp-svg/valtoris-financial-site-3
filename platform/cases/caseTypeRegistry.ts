/**
 * Case type registry — canonical case types for the Advisor Operating System.
 * Aligned with Module Registry caseTypes declarations.
 */

import type { CaseStatus, CaseTypeDefinition, CaseTypeKey } from './types'

const STANDARD_OPEN_STATUSES: readonly CaseStatus[] = [
  'draft',
  'intake',
  'active',
  'waiting',
  'blocked',
  'completed',
  'cancelled',
  'archived',
] as const

function defineCaseType(
  partial: Omit<CaseTypeDefinition, 'allowedStatuses'> & {
    allowedStatuses?: readonly CaseStatus[]
  },
): CaseTypeDefinition {
  return {
    ...partial,
    allowedStatuses: partial.allowedStatuses ?? STANDARD_OPEN_STATUSES,
  }
}

/**
 * Foundation case types.
 * IFD + Onboarding included as metadata examples (not migrated/converted).
 */
export const CASE_TYPE_DEFINITIONS: readonly CaseTypeDefinition[] = [
  defineCaseType({
    caseType: 'diagnostic_review_case',
    moduleKey: 'initial_financial_diagnostic',
    displayName: 'Initial Financial Diagnostic Case',
    description:
      'Review engagement for a public Family Initial Financial Diagnostic (example shape only in 4B.4).',
    initialStatus: 'intake',
    initialStage: 'submitted',
    stages: ['submitted', 'needs_review', 'duplicate_review', 'reviewed', 'closed'] as const,
    defaultPriority: 'high',
    typicalLinks: ['householdId', 'leadId', 'assessmentId', 'taskIds', 'activityIds'],
  }),
  defineCaseType({
    caseType: 'household_onboarding_case',
    moduleKey: 'households',
    displayName: 'Household Onboarding Case',
    description:
      'Advisor-led household onboarding engagement (example shape only in 4B.4).',
    initialStatus: 'draft',
    initialStage: 'in_progress',
    stages: ['in_progress', 'ready_for_review', 'completed', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'assessmentId', 'noteIds', 'activityIds'],
  }),
  defineCaseType({
    caseType: 'insurance_case',
    moduleKey: 'insurance',
    displayName: 'Insurance Case',
    description: 'Personal insurance service delivery Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'discovery', 'quoting', 'issued', 'servicing', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'opportunityId', 'policyIds', 'documentIds', 'taskIds'],
  }),
  defineCaseType({
    caseType: 'credit_repair_case',
    moduleKey: 'credit_repair',
    displayName: 'Credit Repair Case',
    description: 'Credit repair engagement Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'analysis', 'disputes', 'monitoring', 'closed'] as const,
    defaultPriority: 'high',
    typicalLinks: ['householdId', 'documentIds', 'taskIds', 'activityIds'],
  }),
  defineCaseType({
    caseType: 'funding_case',
    moduleKey: 'business_funding',
    displayName: 'Business Funding Case',
    description: 'Business funding application Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'packaging', 'submitted', 'underwriting', 'funded', 'closed'] as const,
    defaultPriority: 'high',
    typicalLinks: ['householdId', 'businessId', 'documentIds', 'opportunityId', 'taskIds'],
  }),
  defineCaseType({
    caseType: 'estate_case',
    moduleKey: 'estate_planning',
    displayName: 'Estate Planning Case',
    description: 'Estate planning engagement Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'planning', 'documents', 'review', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'documentIds', 'recommendationIds', 'taskIds'],
  }),
  defineCaseType({
    caseType: 'tax_strategy_case',
    moduleKey: 'tax_planning',
    displayName: 'Tax Strategy Case',
    description: 'Tax planning / strategy Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'analysis', 'strategy', 'implementation', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'documentIds', 'recommendationIds', 'taskIds'],
  }),
  defineCaseType({
    caseType: 'commercial_insurance_case',
    moduleKey: 'commercial_insurance',
    displayName: 'Commercial Insurance Case',
    description: 'Commercial insurance Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'discovery', 'quoting', 'bound', 'servicing', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'businessId', 'policyIds', 'opportunityId', 'documentIds'],
  }),
  defineCaseType({
    caseType: 'employee_benefits_case',
    moduleKey: 'employee_benefits',
    displayName: 'Employee Benefits Case',
    description: 'Employee benefits Case.',
    initialStatus: 'intake',
    initialStage: 'intake',
    stages: ['intake', 'design', 'enrollment', 'servicing', 'closed'] as const,
    defaultPriority: 'medium',
    typicalLinks: ['householdId', 'businessId', 'documentIds', 'taskIds'],
  }),
] as const

const BY_TYPE = new Map(
  CASE_TYPE_DEFINITIONS.map((definition) => [definition.caseType, definition]),
)

export function listCaseTypeDefinitions(): readonly CaseTypeDefinition[] {
  return CASE_TYPE_DEFINITIONS
}

export function getCaseTypeDefinition(caseType: CaseTypeKey): CaseTypeDefinition | undefined {
  return BY_TYPE.get(caseType)
}

export function requireCaseTypeDefinition(caseType: CaseTypeKey): CaseTypeDefinition {
  const definition = getCaseTypeDefinition(caseType)
  if (!definition) {
    throw new Error(`Case Engine: unknown caseType "${caseType}"`)
  }
  return definition
}

export function listCaseTypes(): string[] {
  return CASE_TYPE_DEFINITIONS.map((definition) => definition.caseType).sort()
}

export function listCaseTypesForModule(moduleKey: string): CaseTypeDefinition[] {
  return CASE_TYPE_DEFINITIONS.filter((definition) => definition.moduleKey === moduleKey)
}

export function isKnownCaseType(caseType: string): boolean {
  return BY_TYPE.has(caseType)
}
