import type { SpecializedAnswerMap } from '../specialized/types'
import { INCOME_SOURCES } from './v2Questions.js'

/** Illustrative planning scenarios, not market quotes or lending program rules. */
export type AffordabilityAssumptions = {
  version: number
  termYears: number
  annualTaxRate: number
  annualInsuranceRate: number
  annualMortgageInsuranceRate: number
  downPaymentRate: number
  closingCostRate: number
  reserveFloor: number
  monthlyHoa: number
  scenarios: readonly [
    { annualInterestRate: number; housingRatio: number; totalDebtRatio: number },
    { annualInterestRate: number; housingRatio: number; totalDebtRatio: number },
  ]
}
export const DEFAULT_AFFORDABILITY_ASSUMPTIONS: AffordabilityAssumptions = {
  version: 1, termYears: 30, annualTaxRate: 0.0125, annualInsuranceRate: 0.005,
  annualMortgageInsuranceRate: 0.006, downPaymentRate: 0.05, closingCostRate: 0.03,
  reserveFloor: 3000, monthlyHoa: 0,
  scenarios: [
    { annualInterestRate: 0.07, housingRatio: 0.28, totalDebtRatio: 0.36 },
    { annualInterestRate: 0.065, housingRatio: 0.32, totalDebtRatio: 0.43 },
  ],
}
export function amount(value: unknown, allowNegative = false): number | null {
  return typeof value === 'string' && /^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(value) && Number(value) >= (allowNegative ? -100_000_000 : 0) && Number(value) <= 100_000_000 ? Number(value) : null
}
export function monthlyIncome(values: SpecializedAnswerMap, prefix: 'primary' | 'co'): number | null {
  if (prefix === 'co' && (values.applicants === 'self' || values.co_applying === 'no')) return 0
  if (prefix === 'co' && values.co_applying !== 'yes') return null
  const sources = values[`${prefix}_sources`]
  if (!Array.isArray(sources) || !sources.length || sources.includes('not_sure')) return null
  if (sources.length === 1 && sources[0] === 'none') return 0
  if (sources.some(s => !INCOME_SOURCES.includes(s as typeof INCOME_SOURCES[number]))) return null
  const period = values[`${prefix}_period`]
  if (period !== 'monthly' && period !== 'annual') return null
  const parts = sources.map(s => amount(values[`${prefix}_${s}`], s === 'net_business'))
  if (parts.some(n => n === null)) return null
  return parts.reduce<number>((sum, n) => sum + (n ?? 0), 0) / (period === 'annual' ? 12 : 1)
}
export function incomeAndDebt(values: SpecializedAnswerMap) {
  const primary = monthlyIncome(values, 'primary'), co = monthlyIncome(values, 'co')
  const debts = ['auto', 'student', 'cards', 'installment', 'support', 'other'].map(k => amount(values[`debt_${k}`]))
  return {
    income: primary === null || co === null ? null : primary + co,
    debt: debts.some(n => n === null) ? null : debts.reduce<number>((sum, n) => sum + (n ?? 0), 0),
  }
}
export type AffordabilityScenario = {
  homePrice: number; monthlyPayment: number; projectedDti: number; cashToClose: number
  limitingFactor: 'income_debt' | 'purchase_funds'
}
export type AffordabilityResult = {
  calculatorVersion: 1
  status: 'available' | 'insufficient_data' | 'no_income' | 'no_capacity' | 'unsupported' | 'invalid_assumptions'
  assumptions: AffordabilityAssumptions
  monthlyIncome: number | null
  monthlyDebt: number | null
  currentDti: number | null
  currentHousingRatio: number | null
  targetPrice: number | null
  targetGap: number | null
  reserveTopUp: number | null
  scenarios: AffordabilityScenario[]
  factors: string[]
}
function validAssumptions(a: AffordabilityAssumptions): boolean {
  const range = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max
  return Number.isInteger(a.version) && a.version > 0 && range(a.termYears, 1, 50) &&
    [a.annualTaxRate, a.annualInsuranceRate, a.annualMortgageInsuranceRate, a.closingCostRate].every(n => range(n, 0, 0.2)) &&
    range(a.downPaymentRate, 0.01, 0.99) && range(a.reserveFloor, 0, 100_000_000) && range(a.monthlyHoa, 0, 100_000) &&
    a.scenarios.length === 2 && a.scenarios.every(s => range(s.annualInterestRate, 0, 0.3) && range(s.housingRatio, 0.01, 1) && range(s.totalDebtRatio, s.housingRatio, 1))
}
/** Stored metrics can outlive UI versions; do not render malformed or unsupported snapshots. */
export function readAffordabilitySnapshot(raw: unknown): AffordabilityResult | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as AffordabilityResult
  const a = r.assumptions
  if (r.calculatorVersion !== 1 || !['available', 'insufficient_data', 'no_income', 'no_capacity', 'unsupported', 'invalid_assumptions'].includes(r.status)) return undefined
  if (!a || !Array.isArray(a.scenarios) || a.scenarios.some(s => !s || typeof s !== 'object') || !validAssumptions(a)) return undefined
  if (!Array.isArray(r.scenarios) || !Array.isArray(r.factors) || r.factors.some(f => !['debt', 'reserves', 'funds', 'stability', 'income'].includes(f))) return undefined
  if (r.status === 'available' && r.scenarios.length !== 2) return undefined
  if (r.scenarios.some(s => !s || ![s.homePrice, s.monthlyPayment, s.projectedDti, s.cashToClose].every(n => Number.isFinite(n) && n >= 0))) return undefined
  if ([r.monthlyDebt, r.currentDti, r.currentHousingRatio, r.targetPrice, r.targetGap, r.reserveTopUp].some(n => n !== null && (!Number.isFinite(n) || n < 0))) return undefined
  if (r.monthlyIncome !== null && !Number.isFinite(r.monthlyIncome)) return undefined
  return r
}
export function calculateAffordability(v: SpecializedAnswerMap, assumptions = DEFAULT_AFFORDABILITY_ASSUMPTIONS): AffordabilityResult {
  // Snapshot configuration so later changes cannot silently alter a stored report.
  const a = { ...assumptions, scenarios: assumptions.scenarios.map(s => ({ ...s })) as unknown as AffordabilityAssumptions['scenarios'] }
  const { income, debt } = incomeAndDebt(v)
  const currentHousing = amount(v.current_housing_payment)
  const retained = amount(v.retained_housing_payment)
  const available = amount(v.available_funds), reserves = amount(v.protected_reserves)
  const target = amount(v.target_price)
  const result: AffordabilityResult = {
    calculatorVersion: 1, status: 'insufficient_data', assumptions: a, monthlyIncome: income, monthlyDebt: debt,
    currentDti: income !== null && income > 0 && debt !== null && (v.current_housing !== 'own' || currentHousing !== null)
      ? (debt + (v.current_housing === 'own' ? currentHousing ?? 0 : 0)) / income : null,
    currentHousingRatio: income !== null && income > 0 && currentHousing !== null ? currentHousing / income : null,
    targetPrice: target, targetGap: null, reserveTopUp: null, scenarios: [], factors: [],
  }
  if (!validAssumptions(a)) return { ...result, status: 'invalid_assumptions' }
  if (v.intended_occupancy !== 'primary' || v.applicants === 'other') return { ...result, status: 'unsupported' }
  if (income === null || debt === null || available === null || reserves === null || retained === null) return result
  if (income <= 0) return { ...result, status: 'no_income' }
  const topUp = Math.max(0, a.reserveFloor - reserves)
  const cash = Math.max(0, available - topUp)
  const hoa = amount(v.hoa) ?? a.monthlyHoa
  result.assumptions.monthlyHoa = hoa
  result.reserveTopUp = topUp
  const scenarios = a.scenarios.map(s => {
    const rate = s.annualInterestRate / 12, months = a.termYears * 12
    const mortgageFactor = rate === 0 ? 1 / months : rate / (1 - Math.pow(1 + rate, -months))
    const paymentPerDollar = (1 - a.downPaymentRate) * mortgageFactor + (a.annualTaxRate + a.annualInsuranceRate) / 12 +
      (a.downPaymentRate < 0.2 ? (1 - a.downPaymentRate) * a.annualMortgageInsuranceRate / 12 : 0)
    const capacity = Math.max(0, Math.min(income * s.housingRatio, income * s.totalDebtRatio - debt - retained))
    const incomePrice = Math.max(0, (capacity - hoa) / paymentPerDollar)
    const cashPrice = cash / (a.downPaymentRate + a.closingCostRate)
    const homePrice = Math.floor(Math.min(incomePrice, cashPrice) / 1000) * 1000
    const monthlyPayment = homePrice > 0 ? homePrice * paymentPerDollar + hoa : 0
    return { homePrice, monthlyPayment, projectedDti: (monthlyPayment + debt + retained) / income,
      cashToClose: homePrice * (a.downPaymentRate + a.closingCostRate),
      limitingFactor: cashPrice < incomePrice ? 'purchase_funds' as const : 'income_debt' as const }
  }).sort((x, y) => x.homePrice - y.homePrice)
  if (debt > 0 || retained > 0) result.factors.push('debt')
  if (topUp > 0) result.factors.push('reserves')
  if (scenarios.some(s => s.limitingFactor === 'purchase_funds')) result.factors.push('funds')
  if (v.industry_years === 'under_1' || v.industry_years === 'not_sure') result.factors.push('stability')
  if (income > 0) result.factors.push('income')
  if (scenarios.some(s => s.homePrice <= 0)) return { ...result, status: 'no_capacity' }
  return { ...result, status: 'available', scenarios, targetGap: target === null ? null : Math.max(0, target - scenarios[1].homePrice) }
}
