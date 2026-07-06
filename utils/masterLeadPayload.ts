import { LeadSubmissionPayload } from './submitLeadToGoogleSheets'

/**
 * Canonical master Leads sheet payload shape.
 * Keys are ordered to match the deployed Apps Script appendRow mapping.
 * Always send every field so values do not shift into adjacent columns.
 */
export type MasterLeadPayloadInput = {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  phone?: string
  age?: string
  state?: string
  maritalStatus?: string
  children?: string
  businessName?: string
  businessType?: string
  annualIncome?: number | string
  housingType?: string
  annualHousing?: number | string
  creditCards?: number | string
  autoLoans?: number | string
  personalLoans?: number | string
  studentLoans?: number | string
  educationPerChild?: number | string
  finalExpenses?: number | string
  existingCoverage?: number | string
  totalNeed?: number | string
  overallScore?: number | string
  overallGrade?: string
  protectionGap?: number | string
  topPriority1?: string
  topPriority2?: string
  topPriority3?: string
  calendlyBooked?: string | boolean
  strategySessionDate?: string
  leadStatus?: string
  assignedAdvisor?: string
  notes?: string
  sourcePage?: string
  rawAnswers?: string
  submittedAt?: string
  timestamp?: string
}

export function buildMasterLeadPayload(input: MasterLeadPayloadInput = {}): LeadSubmissionPayload {
  const submittedAt = input.submittedAt ?? new Date().toISOString()

  return {
    firstName: input.firstName ?? '',
    lastName: input.lastName ?? '',
    fullName: input.fullName ?? '',
    email: input.email ?? '',
    phone: input.phone ?? '',
    age: input.age ?? '',
    state: input.state ?? '',
    maritalStatus: input.maritalStatus ?? '',
    children: input.children ?? '',
    businessName: input.businessName ?? '',
    businessType: input.businessType ?? '',
    annualIncome: input.annualIncome ?? '',
    housingType: input.housingType ?? '',
    annualHousing: input.annualHousing ?? '',
    creditCards: input.creditCards ?? '',
    autoLoans: input.autoLoans ?? '',
    personalLoans: input.personalLoans ?? '',
    studentLoans: input.studentLoans ?? '',
    educationPerChild: input.educationPerChild ?? '',
    finalExpenses: input.finalExpenses ?? '',
    existingCoverage: input.existingCoverage ?? '',
    totalNeed: input.totalNeed ?? '',
    overallScore: input.overallScore ?? '',
    overallGrade: input.overallGrade ?? '',
    protectionGap: input.protectionGap ?? '',
    topPriority1: input.topPriority1 ?? '',
    topPriority2: input.topPriority2 ?? '',
    topPriority3: input.topPriority3 ?? '',
    calendlyBooked: input.calendlyBooked ?? '',
    strategySessionDate: input.strategySessionDate ?? '',
    leadStatus: input.leadStatus ?? '',
    assignedAdvisor: input.assignedAdvisor ?? '',
    notes: input.notes ?? '',
    sourcePage: input.sourcePage ?? '',
    rawAnswers: input.rawAnswers ?? '',
    submittedAt,
    timestamp: input.timestamp ?? submittedAt,
  }
}
