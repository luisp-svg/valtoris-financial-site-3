import { parseAmount } from '../../../components/calculator/calculations.js'
import type { BusinessAssessmentAnswers } from '../../../components/assessment/business/types.js'
import type { RetirementAssessmentAnswers } from '../../../components/assessment/retirement/types.js'
import type { StudentLoanAssessmentAnswers } from '../../../components/assessment/studentLoan/types.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import type { CalculatorAnswers } from '../../../components/calculator/types.js'
import { GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL } from '../../../constants/urls.js'
import { buildMasterLeadPayload } from '../../../utils/masterLeadPayload.js'
import type { LeadSubmissionPayload } from '../../../utils/submitLeadToGoogleSheets.js'
import type {
  FamilyReportCardServerScore,
  GradedReportCardServerScore,
  ProtectionGapServerResult,
  StudentLoanReportCardServerScore,
} from './score.js'
import type { SheetsErrorCategory, SheetsSyncStatus } from './types.js'

export type SheetsWriteResult = {
  status: Extract<SheetsSyncStatus, 'succeeded' | 'failed' | 'skipped'>
  errorCategory?: SheetsErrorCategory
  externalRef?: string
}

export type WriteFamilyReportCardToSheetsOptions = {
  webhookUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * Builds the same master Leads sheet payload shape as the client-side
 * `submitFamilyReportCardLead`, but sourced entirely from the server's
 * canonical recalculated score (never the client-reported one).
 */
export function buildFamilyReportCardSheetsPayload(input: {
  answers: DemoAssessmentAnswers
  score: FamilyReportCardServerScore
  sourcePage?: string | null
  submittedAt?: string | null
}): LeadSubmissionPayload {
  const { answers, score } = input
  const firstName = answers.family.firstName.trim()
  const lastName = answers.family.lastName.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const monthlyHousing = parseAmount(answers.financial.monthlyHousingPayment)
  const totalDebt = parseAmount(answers.financial.totalDebt)

  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email: answers.family.email.trim(),
    phone: answers.family.phone.trim(),
    age: answers.family.age.trim(),
    state: answers.family.state.trim(),
    maritalStatus: answers.family.maritalStatus.trim(),
    children: answers.family.numberOfChildren.trim(),
    annualIncome: parseAmount(answers.financial.householdIncome),
    annualHousing: monthlyHousing > 0 ? monthlyHousing * 12 : '',
    creditCards: totalDebt,
    existingCoverage: parseAmount(answers.protection.currentLifeInsurance),
    overallScore: score.overallScore,
    overallGrade: score.overallGrade,
    protectionGap: score.protectionGapFormatted,
    topPriority1: score.priorities[0]?.title ?? '',
    topPriority2: score.priorities[1]?.title ?? '',
    topPriority3: score.priorities[2]?.title ?? '',
    sourcePage: input.sourcePage ?? '',
    rawAnswers: JSON.stringify(answers),
    submittedAt: input.submittedAt ?? undefined,
  })
}

function revenueBandMidpoint(revenue: string): number | '' {
  switch (revenue) {
    case 'pre-revenue':
      return 0
    case 'under-100k':
      return 50000
    case '100k-249k':
      return 175000
    case '250k-499k':
      return 375000
    case '500k-999k':
      return 750000
    case '1m-2.49m':
      return 1750000
    case '2.5m-4.99m':
      return 3750000
    case '5m-plus':
      return 7500000
    default:
      return ''
  }
}

export function buildBusinessReportCardSheetsPayload(input: {
  answers: BusinessAssessmentAnswers
  score: GradedReportCardServerScore
  sourcePage?: string | null
  submittedAt?: string | null
}): LeadSubmissionPayload {
  const { answers, score } = input
  const firstName = answers.owner.firstName.trim()
  const lastName = answers.owner.lastName.trim()
  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: answers.owner.email.trim(),
    phone: answers.owner.phone.trim(),
    businessName: answers.business.name.trim(),
    businessType: answers.business.industry.trim(),
    businessIndustry: answers.business.industry.trim(),
    entityStructure: answers.foundation.entityStructure.trim(),
    grossAnnualRevenue: answers.business.grossAnnualRevenue.trim(),
    ownerCompensationMethod: answers.business.ownerCompensationMethod.trim(),
    ownerPersonalIncome: answers.business.ownerPersonalIncome.trim(),
    annualIncome: revenueBandMidpoint(answers.business.grossAnnualRevenue),
    overallScore: score.overallScore,
    overallGrade: score.overallGrade,
    protectionGap: score.protectionGapFormatted,
    topPriority1: score.priorities[0]?.title ?? '',
    topPriority2: score.priorities[1]?.title ?? '',
    topPriority3: score.priorities[2]?.title ?? '',
    sourcePage: input.sourcePage ?? '',
    rawAnswers: JSON.stringify(answers),
    submittedAt: input.submittedAt ?? undefined,
  })
}

export function buildRetirementReportCardSheetsPayload(input: {
  answers: RetirementAssessmentAnswers
  score: GradedReportCardServerScore
  sourcePage?: string | null
  submittedAt?: string | null
}): LeadSubmissionPayload {
  const { answers, score } = input
  const firstName = answers.household.firstName.trim()
  const lastName = answers.household.lastName.trim()
  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: answers.household.email.trim(),
    phone: answers.household.phone.trim(),
    age: answers.household.currentAge.trim(),
    state: answers.household.state.trim(),
    maritalStatus: answers.household.maritalStatus.trim(),
    overallScore: score.overallScore,
    overallGrade: score.overallGrade,
    protectionGap: score.protectionGapFormatted,
    topPriority1: score.priorities[0]?.title ?? '',
    topPriority2: score.priorities[1]?.title ?? '',
    topPriority3: score.priorities[2]?.title ?? '',
    sourcePage: input.sourcePage ?? '',
    rawAnswers: JSON.stringify(answers),
    submittedAt: input.submittedAt ?? undefined,
  })
}

export function buildStudentLoanReportCardSheetsPayload(input: {
  answers: StudentLoanAssessmentAnswers
  score: StudentLoanReportCardServerScore
  sourcePage?: string | null
  submittedAt?: string | null
}): LeadSubmissionPayload {
  const { answers, score } = input
  const firstName = answers.contact.firstName.trim()
  const lastName = answers.contact.lastName.trim()
  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: answers.contact.email.trim(),
    phone: answers.contact.phone.trim(),
    overallScore: score.overallScore,
    overallGrade: score.overallGrade,
    topPriority1: score.priorities[0]?.title ?? '',
    topPriority2: score.priorities[1]?.title ?? '',
    topPriority3: score.priorities[2]?.title ?? '',
    notes: 'Student Loan Report Card',
    sourcePage: input.sourcePage ?? '',
    rawAnswers: JSON.stringify(answers),
    submittedAt: input.submittedAt ?? undefined,
  })
}

export function buildProtectionGapSheetsPayload(input: {
  answers: CalculatorAnswers
  result: ProtectionGapServerResult
  sourcePage?: string | null
  submittedAt?: string | null
}): LeadSubmissionPayload {
  const { answers, result } = input
  const firstName = answers.family.firstName.trim()
  const lastName = answers.family.lastName.trim()
  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: answers.family.email.trim(),
    phone: answers.family.phone.trim(),
    age: answers.family.age.trim(),
    state: answers.family.state.trim(),
    maritalStatus: answers.family.maritalStatus.trim(),
    children: answers.family.numberOfChildren.trim(),
    annualIncome: parseAmount(answers.income.annualHouseholdIncome),
    existingCoverage: result.currentProtection,
    totalNeed: result.totalNeed,
    overallScore: '',
    overallGrade: '',
    protectionGap: result.netProtectionGap,
    sourcePage: input.sourcePage ?? '',
    rawAnswers: JSON.stringify(answers),
    submittedAt: input.submittedAt ?? undefined,
  })
}

/** Extracts a small, non-secret external reference from a JSON response body, if present. */
function extractExternalRef(responseText: string): string | undefined {
  const trimmed = responseText.trim()
  if (!trimmed) return undefined

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && 'rowRef' in parsed) {
      const rowRef = (parsed as { rowRef?: unknown }).rowRef
      if (typeof rowRef === 'string' && rowRef.trim()) {
        return rowRef.trim().slice(0, 200)
      }
    }
  } catch {
    // Not JSON — no external ref available. Never surface raw response text.
  }
  return undefined
}

const DEFAULT_TIMEOUT_MS = 8000

/**
 * Secondary Google Sheets write for the public Family Report Card ingest.
 * Single attempt only (no retry loop) — failures are recorded as a sync
 * status on the lead and never block the primary CRM write, which must
 * already have succeeded before this is called.
 *
 * Resolution order for the webhook URL: explicit `options.webhookUrl` →
 * `process.env.GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL` → the hardcoded
 * `constants/urls.ts` fallback used by the existing client flow.
 */
export async function writePublicReportCardToSheets(
  payload: LeadSubmissionPayload,
  leadType: string = 'Family Report Card',
  options: WriteFamilyReportCardToSheetsOptions = {},
): Promise<SheetsWriteResult> {
  const envWebhookUrl =
    typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL : undefined

  const webhookUrl = (options.webhookUrl ?? envWebhookUrl ?? GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL ?? '').trim()

  if (!webhookUrl) {
    return { status: 'skipped', errorCategory: 'not_configured' }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  const body: LeadSubmissionPayload = {
    leadType,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      return { status: 'failed', errorCategory: 'malformed_response' }
    }

    if (!response.ok) {
      return { status: 'failed', errorCategory: 'http_error' }
    }

    return { status: 'succeeded', externalRef: extractExternalRef(responseText) }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'failed', errorCategory: 'timeout' }
    }
    return { status: 'failed', errorCategory: 'network_error' }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export async function writeFamilyReportCardToSheets(
  payload: LeadSubmissionPayload,
  options: WriteFamilyReportCardToSheetsOptions = {},
): Promise<SheetsWriteResult> {
  return writePublicReportCardToSheets(payload, 'Family Report Card', options)
}
