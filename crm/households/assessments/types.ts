/**
 * Household assessment history — public Family Initial Financial Diagnostic.
 * Designed so future assessment types can share list/detail shells.
 */

import type { IntakeConsentSummary } from '../../intake/types'
import type {
  DuplicateReviewStatus,
  IngestMatchStatus,
  SheetsSyncStatus,
} from '../../intake/types'

export const PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL = 'Initial Financial Diagnostic' as const

export const PUBLIC_FAMILY_DIAGNOSTIC_DISCLAIMER =
  'Based on information submitted through the public Family Financial Report Card. This diagnostic is self-reported and does not determine the household’s Financial Progress score.'

export const PUBLIC_FAMILY_DIAGNOSTIC_DETAIL_DISCLAIMER =
  'This result is based on self-reported information from the public Family Financial Report Card. It is separate from the advisor-reviewed Household Financial Progress framework.'

export type DiagnosticCategoryResult = {
  id: string
  title: string
  score: number | null
  grade: string | null
}

export type DiagnosticPriorityItem = {
  title: string
  level: string | null
  why: string | null
  timeline: string | null
  /** System-generated diagnostic priority vs submitted goal selection. */
  source: 'diagnostic' | 'submitted_goal'
}

export type DiagnosticFlagItem = {
  id: string
  label: string
  detail: string | null
}

export type SubmittedDiagnosticSnapshot = {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  age: string | null
  state: string | null
  maritalStatus: string | null
  numberOfChildren: string | null
  householdIncome: string | null
  monthlyHousingPayment: string | null
  totalDebt: string | null
  emergencyFundMonths: string | null
  monthlyCashFlow: string | null
  retirementContribution: string | null
  currentLifeInsurance: string | null
  hasDisabilityProtection: string | null
  hasWill: string | null
  hasTrust: string | null
  beneficiariesReviewed: string | null
  guardianDocumented: string | null
  submittedGoals: string[]
}

export type DiagnosticSourceAttribution = {
  sourcePage: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrerHost: string | null
  originalCampaign: string | null
}

export type DiagnosticLeadSummary = {
  leadId: string
  leadStatus: string
  ingestMatchStatus: IngestMatchStatus | null
  duplicateReviewStatus: DuplicateReviewStatus
  sheetsSyncStatus: SheetsSyncStatus | null
  assignedAdvisorName: string | null
  consent: IntakeConsentSummary
  submittedAt: string | null
  source: DiagnosticSourceAttribution
}

/** Overview / history list row — no raw answers dump. */
export type PublicFamilyDiagnosticListItem = {
  assessmentId: string
  householdId: string
  productLabel: typeof PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL
  overallScore: number | null
  overallGrade: string | null
  completedAt: string
  scoringVersion: number | null
  topPriorities: string[]
  contactPermission: boolean | null
  sheetsSyncStatus: SheetsSyncStatus | null
  ingestMatchStatus: IngestMatchStatus | null
  leadId: string | null
  isLatest: boolean
}

/** Full read-only detail for one public Family diagnostic. */
export type PublicFamilyDiagnosticDetail = {
  assessmentId: string
  householdId: string
  productLabel: typeof PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL
  overallScore: number | null
  overallGrade: string | null
  completedAt: string
  scoringVersion: number | null
  currentLevel: string | null
  categories: DiagnosticCategoryResult[]
  priorities: DiagnosticPriorityItem[]
  flags: DiagnosticFlagItem[]
  submittedSnapshot: SubmittedDiagnosticSnapshot
  consent: IntakeConsentSummary | null
  lead: DiagnosticLeadSummary | null
  protectionGapFormatted: string | null
}

export type HouseholdAssessmentsLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export const PUBLIC_FAMILY_DIAGNOSTIC_HISTORY_LIMIT = 50
