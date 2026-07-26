import type { HouseholdFinancialProgressInput } from '../../types'
import {
  CASH_FLOW_SOURCE_CONFLICT_TOLERANCE,
  RECOGNIZED_BUDGET_METHODS,
  RETIREMENT_NOT_SAVING_BAND,
  RETIREMENT_ONLY_SAVING_BANDS,
} from './constants'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/** Non-negative finite amount, or null. Negatives are invalid for income/expense/contribution bases. */
function parseNonNegativeAmount(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

/**
 * Parses a non-negative rate from decimal (0.15) or whole percent (15 / "15%").
 *
 * Documented rule:
 * - strings containing `%` → always treat as percent / 100
 * - 0 ≤ value ≤ 1 → decimal rate
 * - integer 2–100 → whole percent / 100
 * - non-integer values in (1, 100] without `%` → null (ambiguous: 1.5 vs 150%)
 * - value > 100 or negative / non-finite → null
 */
export function parseRate(value: unknown): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const hasPercent = trimmed.includes('%')
    const parsed = Number.parseFloat(trimmed.replace(/%/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return null
    if (hasPercent) {
      if (parsed > 100) return null
      return parsed / 100
    }
    return parseRate(parsed)
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  if (value <= 1) return value
  if (value > 100) return null
  if (Number.isInteger(value)) return value / 100
  return null
}

/**
 * Like parseRate but allows negative margins (cash flow can be negative).
 */
export function parseSignedRate(value: unknown): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const negative = trimmed.startsWith('-')
    const magnitude = parseRate(negative ? trimmed.slice(1) : trimmed)
    if (magnitude == null) return null
    return negative ? -magnitude : magnitude
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= 0) return parseRate(value)
  const magnitude = parseRate(-value)
  if (magnitude == null) return null
  return -magnitude
}

/**
 * Relative material-difference check using CASH_FLOW_SOURCE_CONFLICT_TOLERANCE.
 * |a − b| / max(|a|, |b|, ε) > tolerance → conflict.
 */
export function valuesMateriallyConflict(
  a: number,
  b: number,
  tolerance: number = CASH_FLOW_SOURCE_CONFLICT_TOLERANCE,
): boolean {
  const denom = Math.max(Math.abs(a), Math.abs(b), Number.EPSILON)
  return Math.abs(a - b) / denom > tolerance
}

function nestedString(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): string | null {
  const sectionRecord = asRecord(answers?.[section])
  return asString(sectionRecord?.[field])
}

function nestedAmount(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): number | null {
  const sectionRecord = asRecord(answers?.[section])
  return parseNonNegativeAmount(sectionRecord?.[field])
}

function firstAmount(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseNonNegativeAmount(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseNonNegativeAmount(financial[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function firstSignedAmount(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseFiniteNumber(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseFiniteNumber(financial[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function firstString(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): string | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = asString(source[key])
      if (direct) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = asString(financial[key])
        if (nested) return nested
      }
    }
  }
  return null
}

function firstRate(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseRate(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseRate(financial[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function firstSignedRate(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseSignedRate(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseSignedRate(financial[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase().replace(/[_]/g, ' ')
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'active' ||
    normalized === 'documented' ||
    normalized === 'has budget' ||
    normalized === 'uses budget'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'none' ||
    normalized === 'no budget' ||
    normalized === 'not budgeting' ||
    normalized === 'does not budget'
  ) {
    return 'no'
  }
  return null
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim()
}

function isRecognizedBudgetMethod(value: string | null): boolean {
  if (value == null) return false
  const normalized = normalizeToken(value)
  return RECOGNIZED_BUDGET_METHODS.some((method) => normalizeToken(method) === normalized)
}

function isRetirementOnlySavingBand(value: string): boolean {
  return (RETIREMENT_ONLY_SAVING_BANDS as readonly string[]).includes(value)
}

/**
 * Reconcile monthly vs annual amounts.
 * Within tolerance → prefer monthly (or annual/12 if monthly absent).
 * Beyond tolerance → conflict (value null).
 */
function reconcileMonthlyAnnual(
  monthly: number | null,
  annual: number | null,
): { value: number | null; conflict: boolean } {
  if (monthly != null && annual != null) {
    const annualAsMonthly = annual / 12
    if (valuesMateriallyConflict(monthly, annualAsMonthly)) {
      return { value: null, conflict: true }
    }
    return { value: monthly, conflict: false }
  }
  if (monthly != null) return { value: monthly, conflict: false }
  if (annual != null) return { value: annual / 12, conflict: false }
  return { value: null, conflict: false }
}

export type CashFlowMarginSource =
  | 'direct_margin'
  | 'income_minus_expenses'
  | 'net_cash_flow_fallback'
  | 'qualitative_cash_flow'
  | null

export type SavingsRateSource = 'derived' | 'calculated' | 'retirement_only' | null

export type BudgetUseLevel = 'active' | 'inconsistent' | 'none' | 'vague' | null

export type QualitativeCashFlow = 'positive' | 'break_even' | 'negative' | 'unsure' | null

export type RetirementOnlyKind =
  | 'percentage_band'
  | 'dollar_contribution'
  | 'employer_contribution'
  | null

export type CashFlowBudgetSignals = {
  /** Final margin used for scoring when available. */
  cashFlowMargin: number | null
  monthlyIncome: number | null
  monthlyExpenses: number | null
  monthlyNetCashFlow: number | null
  cashFlowMarginSource: CashFlowMarginSource
  qualitativeCashFlow: QualitativeCashFlow
  cashFlowDataInvalid: boolean
  /** Monthly vs annual income conflict beyond tolerance. */
  incomeSourceConflict: boolean
  /** Monthly vs annual expense conflict beyond tolerance. */
  expenseSourceConflict: boolean
  /** Derived margin materially conflicts with income − expenses. */
  cashFlowDerivedConflict: boolean
  /** Raw margin from income − expenses when both sides available. */
  rawCashFlowMargin: number | null
  /** Parsed derived cashFlowMargin before conflict resolution. */
  derivedCashFlowMargin: number | null

  hasDocumentedBudget: 'yes' | 'no' | null
  budgetMethod: string | null
  budgetMethodRecognized: boolean
  budgetUse: BudgetUseLevel
  vagueBudgetClaim: boolean
  hasIncomeExpenseWithoutBudget: boolean
  hasGenericBudgetTask: boolean

  /** Final total household savings rate when verified. */
  savingsRate: number | null
  savingsRateSource: SavingsRateSource
  monthlySavingsContributions: number | null
  /** Monthly vs annual savings-contribution conflict. */
  savingsContributionSourceConflict: boolean
  /** Derived savingsRate materially conflicts with contributions ÷ income. */
  savingsDerivedConflict: boolean
  rawSavingsRate: number | null
  derivedSavingsRate: number | null
  retirementContributionBand: string | null
  retirementOnlySavingConfirmed: boolean
  retirementOnlyKind: RetirementOnlyKind
  ambiguousRetirementContribution: boolean
  savingsRateInvalid: boolean
  hasSavingsBalanceOnly: boolean
  hasDebtPaymentOnly: boolean

  expenseTrackingFrequencyRaw: string | null
  hasExpenseTotalsWithoutTracking: boolean
}

function parseQualitativeCashFlow(value: string | null): QualitativeCashFlow {
  if (value == null) return null
  const normalized = normalizeToken(value)
  if (
    normalized === 'save-most-months' ||
    normalized === 'save most months' ||
    normalized === 'positive' ||
    normalized === 'surplus'
  ) {
    return 'positive'
  }
  if (normalized === 'break-even' || normalized === 'break even' || normalized === 'breakeven') {
    return 'break_even'
  }
  if (
    normalized === 'overspend' ||
    normalized === 'negative' ||
    normalized === 'deficit' ||
    normalized === 'spend more'
  ) {
    return 'negative'
  }
  if (normalized === 'unsure' || normalized === 'unknown' || normalized === 'not sure') {
    return 'unsure'
  }
  return null
}

function parseBudgetUse(value: string | null): BudgetUseLevel {
  if (value == null) return null
  const normalized = normalizeToken(value)
  if (
    normalized === 'active' ||
    normalized === 'actively used' ||
    normalized === 'actively-used' ||
    normalized === 'reviewed monthly' ||
    normalized === 'monthly review' ||
    normalized === 'consistent' ||
    normalized === 'regularly reviewed'
  ) {
    return 'active'
  }
  if (
    normalized === 'inconsistent' ||
    normalized === 'occasional' ||
    normalized === 'occasionally' ||
    normalized === 'irregular' ||
    normalized === 'unconfirmed' ||
    normalized === 'partial'
  ) {
    return 'inconsistent'
  }
  if (
    normalized === 'none' ||
    normalized === 'no' ||
    normalized === 'not used' ||
    normalized === 'inactive'
  ) {
    return 'none'
  }
  if (
    normalized === 'tries to budget' ||
    normalized === 'trying' ||
    normalized === 'try to budget' ||
    normalized === 'informal' ||
    normalized === 'vague'
  ) {
    return 'vague'
  }
  return null
}

type PeriodAmounts = {
  monthlyIncome: number | null
  monthlyExpenses: number | null
  incomeSourceConflict: boolean
  expenseSourceConflict: boolean
  invalid: boolean
}

function resolveIncomeAndExpenses(
  sources: Array<Record<string, unknown> | null | undefined>,
  familyAnswers: Record<string, unknown> | null,
): PeriodAmounts {
  const monthlyIncome = firstAmount(sources, [
    'monthlyHouseholdIncome',
    'monthly_household_income',
    'monthlyIncome',
    'monthly_income',
    'monthlyGrossIncome',
    'monthlyNetIncome',
  ])
  const annualIncomeDirect = firstAmount(sources, [
    'annualHouseholdIncome',
    'annual_household_income',
    'annualIncome',
    'annual_income',
    'currentAnnualGrossIncome',
  ])
  const familyAnnual = nestedAmount(familyAnswers, 'financial', 'householdIncome')
  const annualIncome = annualIncomeDirect ?? familyAnnual

  const monthlyExpenses = firstAmount(sources, [
    'monthlyHouseholdExpenses',
    'monthly_household_expenses',
    'monthlyExpenses',
    'monthly_expenses',
    'monthlyTotalExpenses',
    'totalMonthlyExpenses',
  ])
  const annualExpenses = firstAmount(sources, [
    'annualHouseholdExpenses',
    'annual_household_expenses',
    'annualExpenses',
    'annual_expenses',
    'totalAnnualExpenses',
  ])

  const signedIncome = firstSignedAmount(sources, [
    'monthlyHouseholdIncome',
    'monthlyIncome',
    'householdIncome',
    'annualIncome',
  ])
  const signedExpenses = firstSignedAmount(sources, [
    'monthlyHouseholdExpenses',
    'monthlyExpenses',
    'annualExpenses',
    'annualHouseholdExpenses',
  ])
  const invalid =
    (signedIncome != null && signedIncome < 0) ||
    (signedExpenses != null && signedExpenses < 0)

  if (invalid) {
    return {
      monthlyIncome: null,
      monthlyExpenses: null,
      incomeSourceConflict: false,
      expenseSourceConflict: false,
      invalid: true,
    }
  }

  const income = reconcileMonthlyAnnual(monthlyIncome, annualIncome)
  const expenses = reconcileMonthlyAnnual(monthlyExpenses, annualExpenses)

  return {
    monthlyIncome: income.value,
    monthlyExpenses: expenses.value,
    incomeSourceConflict: income.conflict,
    expenseSourceConflict: expenses.conflict,
    invalid: false,
  }
}

type SavingsContributionResolution = {
  /** Verified total household monthly contributions (not retirement-only). */
  totalMonthly: number | null
  conflict: boolean
  retirementOnlyDollar: boolean
  employerOnly: boolean
}

/**
 * Resolves total household savings contributions without double-counting.
 * Retirement-only or employer-only amounts are not treated as a verified total rate base.
 */
function resolveSavingsContributions(
  sources: Array<Record<string, unknown> | null | undefined>,
): SavingsContributionResolution {
  const monthlyTotal = firstAmount(sources, [
    'totalMonthlySavings',
    'total_monthly_savings',
    'monthlySavingsContribution',
    'monthly_savings_contribution',
    'monthlySavingsContributions',
    'recurringMonthlySavings',
    'householdMonthlySavings',
  ])
  const annualTotal = firstAmount(sources, [
    'totalAnnualSavings',
    'annualSavingsContribution',
    'annual_savings_contribution',
    'householdAnnualSavings',
  ])
  const totalReconciled = reconcileMonthlyAnnual(monthlyTotal, annualTotal)
  if (totalReconciled.conflict) {
    return {
      totalMonthly: null,
      conflict: true,
      retirementOnlyDollar: false,
      employerOnly: false,
    }
  }
  if (totalReconciled.value != null) {
    return {
      totalMonthly: totalReconciled.value,
      conflict: false,
      retirementOnlyDollar: false,
      employerOnly: false,
    }
  }

  const retirementMonthly = firstAmount(sources, [
    'monthlyRetirementContribution',
    'monthly_retirement_contribution',
    'retirementMonthlyContribution',
  ])
  const retirementAnnual = firstAmount(sources, [
    'annualRetirementContribution',
    'annual_retirement_contribution',
  ])
  const retirementReconciled = reconcileMonthlyAnnual(retirementMonthly, retirementAnnual)

  const emergency = firstAmount(sources, [
    'monthlyEmergencyContribution',
    'monthly_emergency_contribution',
    'emergencySavingsContribution',
  ])
  const investment = firstAmount(sources, [
    'monthlyInvestmentContribution',
    'monthly_investment_contribution',
    'investmentContribution',
  ])
  const general = firstAmount(sources, [
    'monthlyGeneralSavingsContribution',
    'generalSavingsContribution',
  ])
  const employer = firstAmount(sources, [
    'employerRetirementContribution',
    'employer_retirement_contribution',
    'employerMatch',
    'employer_match',
    'employerContribution',
  ])

  if (retirementReconciled.conflict) {
    return {
      totalMonthly: null,
      conflict: true,
      retirementOnlyDollar: false,
      employerOnly: false,
    }
  }

  const nonRetirement = [emergency, investment, general].filter(
    (value): value is number => value != null,
  )
  const retirement = retirementReconciled.value

  // Distinct non-overlapping buckets → verified total household contributions.
  if (nonRetirement.length > 0) {
    const parts = [...nonRetirement]
    if (retirement != null) parts.push(retirement)
    // Employer match is often already in retirement contribution; only add when
    // no employee retirement amount exists (employer-only is handled below).
    return {
      totalMonthly: parts.reduce((sum, value) => sum + value, 0),
      conflict: false,
      retirementOnlyDollar: false,
      employerOnly: false,
    }
  }

  if (retirement != null) {
    return {
      totalMonthly: null,
      conflict: false,
      retirementOnlyDollar: true,
      employerOnly: false,
    }
  }

  if (employer != null && employer > 0) {
    return {
      totalMonthly: null,
      conflict: false,
      retirementOnlyDollar: false,
      employerOnly: true,
    }
  }

  return {
    totalMonthly: null,
    conflict: false,
    retirementOnlyDollar: false,
    employerOnly: false,
  }
}

/**
 * Extracts Cash Flow & Budget signals. Normalizes values; does not score.
 */
export function extractCashFlowBudgetSignals(
  input: HouseholdFinancialProgressInput,
): CashFlowBudgetSignals {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const sources = [
    input.assessments?.family?.derived_metrics,
    input.assessments?.retirement?.derived_metrics,
    input.assessments?.protection?.derived_metrics,
    familyAnswers,
    retirementAnswers,
  ]

  const period = resolveIncomeAndExpenses(sources, familyAnswers)
  const monthlyIncome = period.monthlyIncome
  const monthlyExpenses = period.monthlyExpenses

  const derivedCashFlowMargin = firstSignedRate(sources, [
    'cashFlowMargin',
    'cash_flow_margin',
    'monthlyCashFlowMargin',
  ])

  let rawCashFlowMargin: number | null = null
  if (
    monthlyIncome != null &&
    monthlyExpenses != null &&
    monthlyIncome > 0 &&
    Number.isFinite(monthlyIncome) &&
    Number.isFinite(monthlyExpenses)
  ) {
    rawCashFlowMargin = (monthlyIncome - monthlyExpenses) / monthlyIncome
  }

  let cashFlowMargin: number | null = null
  let cashFlowMarginSource: CashFlowMarginSource = null
  let cashFlowDerivedConflict = false
  let cashFlowDataInvalid = period.invalid

  if (period.invalid || (monthlyIncome != null && monthlyIncome <= 0 && monthlyExpenses != null)) {
    cashFlowDataInvalid = true
  }

  const canUsePeriodForMargin =
    !period.incomeSourceConflict &&
    !period.expenseSourceConflict &&
    !cashFlowDataInvalid &&
    rawCashFlowMargin != null

  if (derivedCashFlowMargin != null && canUsePeriodForMargin) {
    if (valuesMateriallyConflict(derivedCashFlowMargin, rawCashFlowMargin!)) {
      cashFlowDerivedConflict = true
      cashFlowMargin = null
      cashFlowMarginSource = null
    } else {
      cashFlowMargin = derivedCashFlowMargin
      cashFlowMarginSource = 'direct_margin'
    }
  } else if (derivedCashFlowMargin != null && !canUsePeriodForMargin) {
    // Derived without sufficient/consistent raw period data.
    cashFlowMargin = derivedCashFlowMargin
    cashFlowMarginSource = 'direct_margin'
  } else if (canUsePeriodForMargin) {
    // Invalid/missing derived → use valid raw calculation.
    cashFlowMargin = rawCashFlowMargin
    cashFlowMarginSource = 'income_minus_expenses'
  }

  const monthlyNetCashFlow = firstSignedAmount(sources, [
    'monthlyNetCashFlow',
    'monthly_net_cash_flow',
    'monthlyCashFlowAmount',
    'netMonthlyCashFlow',
  ])

  const qualitativeRaw =
    nestedString(familyAnswers, 'financial', 'monthlyCashFlow') ??
    firstString(sources, ['monthlyCashFlow', 'monthly_cash_flow', 'cashFlowPattern'])
  const qualitativeCashFlow = parseQualitativeCashFlow(qualitativeRaw)

  if (cashFlowMargin == null && !cashFlowDerivedConflict) {
    if (monthlyNetCashFlow != null && Number.isFinite(monthlyNetCashFlow)) {
      cashFlowMarginSource = 'net_cash_flow_fallback'
    } else if (qualitativeCashFlow != null && qualitativeCashFlow !== 'unsure') {
      cashFlowMarginSource = 'qualitative_cash_flow'
    }
  }

  const hasBudgetRaw = firstString(sources, [
    'hasBudget',
    'has_budget',
    'hasWrittenBudget',
    'hasDocumentedBudget',
    'usesBudget',
    'hasSpendingPlan',
  ])
  const budgetMethod = firstString(sources, [
    'budgetingMethod',
    'budgeting_method',
    'budgetMethod',
    'budget_method',
    'spendingPlanMethod',
  ])
  const budgetUseRaw = firstString(sources, [
    'budgetUse',
    'budget_use',
    'budgetReviewFrequency',
    'budget_review_frequency',
    'budgetReviewStatus',
    'budgetActivelyUsed',
    'budgetStatus',
  ])
  const vagueBudgetRaw = firstString(sources, [
    'budgetingHabit',
    'budgeting_habit',
    'budgetDescription',
  ])

  let hasDocumentedBudget = yesNoFromString(hasBudgetRaw)
  let budgetUse = parseBudgetUse(budgetUseRaw) ?? parseBudgetUse(vagueBudgetRaw)
  let vagueBudgetClaim = budgetUse === 'vague'

  if (vagueBudgetRaw && parseBudgetUse(vagueBudgetRaw) === 'vague') {
    vagueBudgetClaim = true
    if (budgetUse == null) budgetUse = 'vague'
  }

  const budgetMethodRecognized = isRecognizedBudgetMethod(budgetMethod)
  if (hasDocumentedBudget == null && budgetMethodRecognized) {
    hasDocumentedBudget = 'yes'
  }

  const hasIncomeExpenseWithoutBudget =
    (monthlyIncome != null || monthlyExpenses != null) &&
    hasDocumentedBudget == null &&
    !budgetMethodRecognized &&
    budgetUse == null

  const hasGenericBudgetTask = (input.openTasks ?? []).some((task) => {
    const title = task.title.toLowerCase()
    return (
      (title.includes('budget') || title.includes('spending plan')) &&
      !title.includes('review budget') &&
      !title.includes('update budget')
    )
  })

  const derivedSavingsRateRaw = firstRate(sources, [
    'savingsRate',
    'savings_rate',
    'householdSavingsRate',
  ])
  const derivedSavingsPresent = sources.some((source) => {
    if (!source) return false
    const financial = asRecord(source.financial)
    return (
      source.savingsRate != null ||
      source.savings_rate != null ||
      source.householdSavingsRate != null ||
      (financial != null &&
        (financial.savingsRate != null ||
          financial.savings_rate != null ||
          financial.householdSavingsRate != null))
    )
  })
  // Invalid derived (e.g. 150) does not block a valid raw calculation.
  const derivedSavingsUnusable =
    derivedSavingsPresent && (derivedSavingsRateRaw == null || derivedSavingsRateRaw > 1)

  const contributions = resolveSavingsContributions(sources)
  const monthlySavingsContributions = contributions.totalMonthly

  let rawSavingsRate: number | null = null
  let rawSavingsImplausible = false
  if (
    monthlySavingsContributions != null &&
    monthlyIncome != null &&
    monthlyIncome > 0 &&
    !period.incomeSourceConflict &&
    !contributions.conflict &&
    Number.isFinite(monthlySavingsContributions)
  ) {
    const calculated = monthlySavingsContributions / monthlyIncome
    if (calculated > 1) {
      rawSavingsImplausible = true
    } else if (calculated >= 0) {
      rawSavingsRate = calculated
    }
  }

  let savingsRate: number | null = null
  let savingsRateSource: SavingsRateSource = null
  let savingsDerivedConflict = false

  const canUseRawSavings =
    rawSavingsRate != null && !period.incomeSourceConflict && !contributions.conflict

  if (derivedSavingsRateRaw != null && derivedSavingsRateRaw <= 1 && canUseRawSavings) {
    if (valuesMateriallyConflict(derivedSavingsRateRaw, rawSavingsRate!)) {
      savingsDerivedConflict = true
      savingsRate = null
      savingsRateSource = null
    } else {
      savingsRate = derivedSavingsRateRaw
      savingsRateSource = 'derived'
    }
  } else if (derivedSavingsRateRaw != null && derivedSavingsRateRaw <= 1 && !canUseRawSavings) {
    savingsRate = derivedSavingsRateRaw
    savingsRateSource = 'derived'
  } else if (canUseRawSavings) {
    // Invalid/missing derived with valid raw → use raw.
    savingsRate = rawSavingsRate
    savingsRateSource = 'calculated'
  }

  let savingsRateInvalid =
    (monthlySavingsContributions != null && monthlySavingsContributions < 0) ||
    rawSavingsImplausible ||
    (derivedSavingsUnusable && !canUseRawSavings && savingsRate == null)

  const retirementContributionBand =
    nestedString(familyAnswers, 'financial', 'retirementContribution') ??
    firstString(sources, ['retirementContribution', 'retirement_contribution'])

  let retirementOnlySavingConfirmed = false
  let retirementOnlyKind: RetirementOnlyKind = null
  let ambiguousRetirementContribution = false

  if (savingsRate == null && !savingsDerivedConflict && !savingsRateInvalid) {
    if (contributions.retirementOnlyDollar) {
      retirementOnlySavingConfirmed = true
      retirementOnlyKind = 'dollar_contribution'
      savingsRateSource = 'retirement_only'
    } else if (contributions.employerOnly) {
      retirementOnlySavingConfirmed = true
      retirementOnlyKind = 'employer_contribution'
      savingsRateSource = 'retirement_only'
    } else if (retirementContributionBand) {
      if (isRetirementOnlySavingBand(retirementContributionBand)) {
        retirementOnlySavingConfirmed = true
        retirementOnlyKind = 'percentage_band'
        savingsRateSource = 'retirement_only'
      } else if (retirementContributionBand === RETIREMENT_NOT_SAVING_BAND) {
        // Retirement non-saving is not a verified total household 0% rate.
        retirementOnlySavingConfirmed = false
        savingsRateSource = null
      } else {
        ambiguousRetirementContribution = true
      }
    }
  }

  const rawContribution = firstSignedAmount(sources, [
    'monthlySavingsContribution',
    'totalMonthlySavings',
    'monthlyRetirementContribution',
  ])
  if (rawContribution != null && rawContribution < 0) {
    savingsRateInvalid = true
    savingsRate = null
    savingsRateSource = null
    retirementOnlySavingConfirmed = false
  }

  const hasSavingsBalanceOnly =
    firstAmount(sources, [
      'savingsBalance',
      'emergencyFundBalance',
      'checkingBalance',
      'investmentBalance',
    ]) != null &&
    monthlySavingsContributions == null &&
    derivedSavingsRateRaw == null &&
    !retirementOnlySavingConfirmed &&
    retirementContributionBand == null

  const hasDebtPaymentOnly =
    firstAmount(sources, ['monthlyDebtPayment', 'debtPayment', 'minimumDebtPayment']) != null &&
    monthlySavingsContributions == null &&
    derivedSavingsRateRaw == null &&
    !retirementOnlySavingConfirmed

  const expenseTrackingFrequencyRaw = firstString(sources, [
    'expenseTrackingFrequency',
    'expense_tracking_frequency',
    'spendingReviewFrequency',
    'expenseReviewFrequency',
    'tracksExpenses',
    'expenseTracking',
  ])

  const hasExpenseTotalsWithoutTracking =
    monthlyExpenses != null && expenseTrackingFrequencyRaw == null

  return {
    cashFlowMargin,
    monthlyIncome,
    monthlyExpenses,
    monthlyNetCashFlow,
    cashFlowMarginSource,
    qualitativeCashFlow,
    cashFlowDataInvalid,
    incomeSourceConflict: period.incomeSourceConflict,
    expenseSourceConflict: period.expenseSourceConflict,
    cashFlowDerivedConflict,
    rawCashFlowMargin,
    derivedCashFlowMargin,
    hasDocumentedBudget,
    budgetMethod,
    budgetMethodRecognized,
    budgetUse,
    vagueBudgetClaim,
    hasIncomeExpenseWithoutBudget,
    hasGenericBudgetTask,
    savingsRate,
    savingsRateSource,
    monthlySavingsContributions,
    savingsContributionSourceConflict: contributions.conflict,
    savingsDerivedConflict,
    rawSavingsRate,
    derivedSavingsRate: derivedSavingsRateRaw,
    retirementContributionBand,
    retirementOnlySavingConfirmed,
    retirementOnlyKind,
    ambiguousRetirementContribution,
    savingsRateInvalid,
    hasSavingsBalanceOnly,
    hasDebtPaymentOnly,
    expenseTrackingFrequencyRaw,
    hasExpenseTotalsWithoutTracking,
  }
}
