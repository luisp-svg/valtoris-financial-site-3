import { scoreToGrade } from '../../../components/assessment/scoring/scoreFamilyAssessment.js'
import { numericAnswer, type ShortDiagnostic } from './contract.js'

export type BuyerReadiness = {
  version: 1
  score: number
  grade: string
  provisional: boolean
  categories: { id: 'credit' | 'debt_budget' | 'purchase_funds' | 'employment' | 'documents'; score: number | null; max: number }[]
}
/** Valtoris educational rubric for the revised short questionnaire, not a lending model. */
export function scoreBuyerReadiness(d: ShortDiagnostic): BuyerReadiness | undefined {
  // Old income-stability answers are not employment-tenure evidence.
  if (!Object.prototype.hasOwnProperty.call(d, 'employment_tenure')) return undefined
  const amount = (key: string) => {
    const n = numericAnswer(d[key])
    return n !== null && n <= 1_000_000_000 ? n : null
  }
  const rangePoints: Record<string, number> = { '740_plus': 30, '700_739': 27, '620_699': 20, 'below_620': 10 }
  const risks = d.credit_issues
  let credit: number | null = typeof d.credit_range === 'string' ? rangePoints[d.credit_range] ?? null : null
  if (!Array.isArray(risks) || !risks.length || risks.includes('unknown')) credit = null
  else if (credit !== null) {
    const penalties: Record<string, number> = { late: 5, collections: 7, bankruptcy_foreclosure: 10, errors: 3, none: 0 }
    if (risks.some(r => penalties[r] === undefined)) credit = null
    else credit = Math.max(0, credit - risks.reduce((sum, r) => sum + penalties[r], 0))
  }
  const income = amount('income'), debt = amount('debt_payment'), budget = amount('budget'), funds = amount('purchase_funds')
  let debtBudget: number | null = null
  if (income !== null && debt !== null && budget !== null) {
    const ratio = income > 0 ? (debt + budget) / income : Infinity
    debtBudget = income <= 0 || budget <= 0 ? 0 : ratio <= 0.36 ? 25 : ratio <= 0.43 ? 18 : ratio <= 0.50 ? 8 : 0
  }
  let purchaseFunds: number | null = null
  if (funds !== null && budget !== null) {
    const multiples = budget > 0 ? funds / budget : 0
    purchaseFunds = multiples >= 6 ? 20 : multiples >= 3 ? 15 : multiples >= 1 ? 8 : funds > 0 && budget > 0 ? 4 : 0
  }
  const employment = d.employment_tenure === '2_plus_years' ? 15 : d.employment_tenure === 'under_2_years' ? 7 : null
  const docs = d.documents
  const documents = !Array.isArray(docs) || !docs.length || docs.includes('unknown') ? null
    : (docs.includes('income') ? 5 : 0) + (docs.includes('bank') ? 5 : 0)
  const categories: BuyerReadiness['categories'] = [
    { id: 'credit', score: credit, max: 30 }, { id: 'debt_budget', score: debtBudget, max: 25 },
    { id: 'purchase_funds', score: purchaseFunds, max: 20 }, { id: 'employment', score: employment, max: 15 },
    { id: 'documents', score: documents, max: 10 },
  ]
  const score = categories.reduce((sum, c) => sum + (c.score ?? 0), 0)
  return { version: 1, score, grade: scoreToGrade(score), provisional: categories.some(c => c.score === null), categories }
}
export function isBuyerReadiness(raw: unknown): raw is BuyerReadiness {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as BuyerReadiness
  if (r.version !== 1 || !Number.isInteger(r.score) || r.score < 0 || r.score > 100 || r.grade !== scoreToGrade(r.score) || typeof r.provisional !== 'boolean') return false
  const specs = [['credit', 30], ['debt_budget', 25], ['purchase_funds', 20], ['employment', 15], ['documents', 10]] as const
  if (!Array.isArray(r.categories) || r.categories.length !== specs.length) return false
  if (!specs.every(([id, max], i) => {
    const c = r.categories[i]
    return c && c.id === id && c.max === max && (c.score === null || Number.isInteger(c.score) && c.score >= 0 && c.score <= max)
  })) return false
  return r.score === r.categories.reduce((sum, c) => sum + (c.score ?? 0), 0) && r.provisional === r.categories.some(c => c.score === null)
}
