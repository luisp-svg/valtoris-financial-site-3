import { numericAnswer, type ShortDiagnostic } from './contract.js'

/** Versioned planning assumptions, not underwriting limits or current lender offers. */
export const HOME_PAYMENT_ASSUMPTIONS = {
  conservativeHousingRatio: 0.28,
  conservativeTotalDebtRatio: 0.36,
  upperHousingRatio: 0.32,
  upperTotalDebtRatio: 0.43,
} as const
export type HomePaymentRange = {
  version: 1
  status: 'available' | 'insufficient_data' | 'no_capacity' | 'unsupported'
  grossMonthlyIncome: number | null
  monthlyDebt: number | null
  maximumHousingPayment: number | null
  occupancy: string
  lowerMonthlyPayment: number | null
  upperMonthlyPayment: number | null
  assumptions: typeof HOME_PAYMENT_ASSUMPTIONS
}
function readAmount(value: unknown): number | null {
  const n = numericAnswer(value)
  return n !== null && n >= 0 && n <= 1_000_000_000 ? n : null
}
/** All-in housing budget: cap each scenario by income, total debts and personal budget. */
export function calculateHomePaymentRange(d: ShortDiagnostic): HomePaymentRange {
  const income = readAmount(d.income), debt = readAmount(d.debt_payment), budget = readAmount(d.budget)
  const occupancy = typeof d.occupancy === 'string' ? d.occupancy : ''
  const assumptions = { ...HOME_PAYMENT_ASSUMPTIONS }
  const result: HomePaymentRange = {
    version: 1, status: 'insufficient_data', grossMonthlyIncome: income, monthlyDebt: debt,
    maximumHousingPayment: budget, occupancy, lowerMonthlyPayment: null, upperMonthlyPayment: null, assumptions,
  }
  if (occupancy === 'second' || occupancy === 'investment') return { ...result, status: 'unsupported' }
  if (occupancy !== 'primary' || income === null || debt === null || budget === null) return result
  const capacity = (housingRatio: number, totalDebtRatio: number) =>
    Math.floor(Math.max(0, Math.min(income * housingRatio, income * totalDebtRatio - debt, budget)))
  const lower = capacity(assumptions.conservativeHousingRatio, assumptions.conservativeTotalDebtRatio)
  const upper = capacity(assumptions.upperHousingRatio, assumptions.upperTotalDebtRatio)
  return { ...result, status: upper > 0 ? 'available' : 'no_capacity', lowerMonthlyPayment: lower, upperMonthlyPayment: upper }
}
/** Validate saved v1 snapshots without changing the assumptions used to create them. */
export function isHomePaymentRange(raw: unknown): raw is HomePaymentRange {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as HomePaymentRange
  if (r.version !== 1 || typeof r.occupancy !== 'string' || !r.assumptions || typeof r.assumptions !== 'object') return false
  for (const key of ['grossMonthlyIncome', 'monthlyDebt', 'maximumHousingPayment', 'lowerMonthlyPayment', 'upperMonthlyPayment'] as const) {
    if (r[key] !== null && (typeof r[key] !== 'number' || !Number.isFinite(r[key]) || r[key] < 0 || r[key] > 1_000_000_000)) return false
  }
  if (Object.entries(HOME_PAYMENT_ASSUMPTIONS).some(([key, value]) => r.assumptions[key as keyof typeof HOME_PAYMENT_ASSUMPTIONS] !== value)) return false
  const expected = calculateHomePaymentRange({
    income: r.grossMonthlyIncome === null ? 'unknown' : String(r.grossMonthlyIncome),
    debt_payment: r.monthlyDebt === null ? 'unknown' : String(r.monthlyDebt),
    budget: r.maximumHousingPayment === null ? 'unknown' : String(r.maximumHousingPayment), occupancy: r.occupancy,
  })
  return r.status === expected.status && r.lowerMonthlyPayment === expected.lowerMonthlyPayment && r.upperMonthlyPayment === expected.upperMonthlyPayment
}
