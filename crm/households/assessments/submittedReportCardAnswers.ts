import { INITIAL_HOME_BUYER_ANSWERS } from '../../../components/assessment/homeBuyer/types'
import { homeBuyerCopy } from '../../../components/assessment/homeBuyer/copy'
import { INITIAL_DEMO_ANSWERS } from '../../../components/assessment/types'
import { INITIAL_BUSINESS_ANSWERS } from '../../../components/assessment/business/types'
import { INITIAL_RETIREMENT_ANSWERS } from '../../../components/assessment/retirement/types'
import { INITIAL_CALCULATOR_ANSWERS } from '../../../components/calculator/types'
import { familyCopy } from '../../../components/assessment/family/copy'
import { businessCopy } from '../../../components/assessment/business/copy'
import { retirementCopy } from '../../../components/assessment/retirement/copy'
import { protectionCopy } from '../../../components/calculator/protectionCopy'
import type { SpecializedProductCopy } from '../../../components/assessment/specialized/types'
import type { DiagnosticSubmittedAnswer } from './types'

const catalogs: Record<string, { shape: object; copy: SpecializedProductCopy }> = {
  home_buyer: { shape: { diagnostic: INITIAL_HOME_BUYER_ANSWERS.diagnostic }, copy: homeBuyerCopy },
  family: { shape: INITIAL_DEMO_ANSWERS, copy: familyCopy },
  business: { shape: INITIAL_BUSINESS_ANSWERS, copy: businessCopy },
  retirement: { shape: INITIAL_RETIREMENT_ANSWERS, copy: retirementCopy },
  protection: { shape: INITIAL_CALCULATOR_ANSWERS, copy: protectionCopy },
}

const fieldAliases: Record<string, string> = {
  'business.name': 'businessName',
  'goals.selected': 'goals',
  'education.numberOfChildren': 'educationChildren',
  'finalExpenses.amount': 'finalExpenses',
  'finalExpenses.customAmount': 'customFinalExpenses',
}
const answerAliases: Record<string, string> = {
  preferredContactMethod: 'contactMethod',
  bestContactTime: 'contactTime',
  expectsPartTimeWork: 'expectsPartTime',
  socialSecurityEstimateReviewed: 'yesNoUnsure',
  inflationAwareness: 'yesNoUnsure',
  pensionElectionUnderstood: 'yesNoNaUnsure',
  survivorContinuation: 'yesNoNaUnsure',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

/** Read only known questionnaire fields; never render arbitrary stored JSON or fill defaults. */
export function extractReportCardSubmittedAnswers(type: string, answers: unknown): DiagnosticSubmittedAnswer[] {
  const catalog = catalogs[type]
  if (!catalog) return []
  const root = record(answers)
  const copy = catalog.copy.en
  const rows: DiagnosticSubmittedAnswer[] = []
  for (const [section, shape] of Object.entries(catalog.shape)) {
    const values = record(root[section])
    for (const field of Object.keys(shape)) {
      // Consent is shown separately from the authoritative lead consent snapshot.
      if (section === 'leadDetails' && field === 'consentGiven') continue
      const id = `${section}.${field}`
      const key = fieldAliases[id] ?? field
      const label = copy?.fields[key]
      if (!label) continue
      const raw = values[field]
      const entries = Array.isArray(raw) ? raw : [raw]
      const value = entries.flatMap(entry => {
        if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') return []
        if (typeof entry === 'number' && !Number.isFinite(entry)) return []
        const text = String(entry).trim()
        if (!text) return []
        return [copy?.answers[`${answerAliases[key] ?? key}.${text}`] ?? copy?.answers[text] ?? text]
      }).join(', ')
      if (value) rows.push({ id, label, value })
    }
  }
  return rows
}
