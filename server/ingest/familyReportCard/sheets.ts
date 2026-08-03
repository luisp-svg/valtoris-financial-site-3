import { parseAmount } from '../../../components/calculator/calculations'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types'
import { GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL } from '../../../constants/urls'
import { buildMasterLeadPayload } from '../../../utils/masterLeadPayload'
import type { LeadSubmissionPayload } from '../../../utils/submitLeadToGoogleSheets'
import type { FamilyReportCardServerScore } from './score'
import type { SheetsErrorCategory, SheetsSyncStatus } from './types'

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
export async function writeFamilyReportCardToSheets(
  payload: LeadSubmissionPayload,
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
    leadType: 'Family Report Card',
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
