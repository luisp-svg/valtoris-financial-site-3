import type { HouseholdFinancialProgressInput } from '../../types'
import { RECOGNIZED_PAYOFF_METHODS } from './constants'

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

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

/** Non-negative finite amount, or null. */
function parseNonNegativeAmount(value: unknown): number | null {
  const parsed = parseAmount(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

/**
 * Parses APR from decimal (0.20) or percent (20 / "20%").
 * Rejects non-finite and negative values.
 */
export function parseApr(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) return null
    if (value > 1 && value <= 100) return value / 100
    if (value > 100) return null
    return value
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/%/g, '')
  if (trimmed === '') return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  if (parsed > 1 && parsed <= 100) return parsed / 100
  if (parsed > 100) return null
  return parsed
}

function parseRatio(value: unknown): number | null {
  return parseApr(value)
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
      const debt = asRecord(source.debt)
      if (debt) {
        const nested = parseNonNegativeAmount(debt[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function firstApr(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseApr(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseApr(financial[key])
        if (nested != null) return nested
      }
      const debt = asRecord(source.debt)
      if (debt) {
        const nested = parseApr(debt[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function firstRatio(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseRatio(source[key])
      if (direct != null) return direct
      const financial = asRecord(source.financial)
      if (financial) {
        const nested = parseRatio(financial[key])
        if (nested != null) return nested
      }
      const debt = asRecord(source.debt)
      if (debt) {
        const nested = parseRatio(debt[key])
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
      const debt = asRecord(source.debt)
      if (debt) {
        const nested = asString(debt[key])
        if (nested) return nested
      }
      const lifestyle = asRecord(source.lifestyle)
      if (lifestyle) {
        const nested = asString(lifestyle[key])
        if (nested) return nested
      }
    }
  }
  return null
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase()
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'documented' ||
    normalized === 'in-place' ||
    normalized === 'active'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'none' ||
    normalized === 'not-documented'
  ) {
    return 'no'
  }
  return null
}

export function textIncludesRecognizedPayoffMethod(text: string | null): boolean {
  if (!text) return false
  const normalized = text.toLowerCase()
  return RECOGNIZED_PAYOFF_METHODS.some((method) => normalized.includes(method))
}

/**
 * Debt-related task (intent) — must mention debt/payoff context.
 * Does not alone establish a complete strategy method.
 */
export function isDebtRelatedTaskTitle(title: string): boolean {
  const normalized = title.toLowerCase()
  const debtContext =
    normalized.includes('debt') ||
    normalized.includes('payoff') ||
    normalized.includes('pay off') ||
    normalized.includes('credit card') ||
    normalized.includes('revolving')
  if (!debtContext) return false
  return (
    normalized.includes('debt') ||
    normalized.includes('payoff') ||
    normalized.includes('pay off') ||
    normalized.includes('snowball') ||
    normalized.includes('avalanche') ||
    normalized.includes('consolidation') ||
    normalized.includes('refinanc')
  )
}

function collectDebtRelatedTaskTitles(
  tasks: HouseholdFinancialProgressInput['openTasks'],
): string[] {
  if (!tasks || tasks.length === 0) return []
  return tasks.map((task) => task.title).filter(isDebtRelatedTaskTitle)
}

export type DebtSignals = {
  /** Annual household income when finite and usable; null if missing/invalid. */
  householdIncome: number | null
  /** Total recorded debt when finite and non-negative; null if missing/invalid. */
  totalDebt: number | null
  creditCardDebt: number | null
  creditCardLimit: number | null
  creditCardUtilization: number | null
  /** Recorded APR as decimal, when available. */
  recordedApr: number | null
  /** Explicit high-interest balance when recorded (including 0). */
  highInterestDebt: number | null
  hasHighInterestDebt: 'yes' | 'no' | null
  debtBurden: string | null
  payoffStrategyAnswer: 'yes' | 'no' | null
  payoffStrategyLabel: string | null
  payoffMethod: string | null
  targetPayment: number | null
  payoffOrder: string | null
  debtRelatedTaskTitles: string[]
}

/**
 * Extracts debt signals from existing household assessments / derived metrics / tasks.
 * Never fabricates utilization, APRs, or balances.
 */
export function extractDebtSignals(input: HouseholdFinancialProgressInput): DebtSignals {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const protectionAnswers = input.assessments?.protection?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const sources = [
    input.assessments?.family?.derived_metrics,
    input.assessments?.protection?.derived_metrics,
    input.assessments?.retirement?.derived_metrics,
    familyAnswers,
    protectionAnswers,
    retirementAnswers,
  ]

  const creditCardDebt =
    firstAmount(sources, ['creditCardDebt', 'credit_card_debt', 'revolvingDebt']) ??
    nestedAmount(familyAnswers, 'debt', 'creditCardDebt')

  const creditCardLimit = firstAmount(sources, [
    'creditCardLimit',
    'credit_card_limit',
    'revolvingCreditLimit',
  ])

  let creditCardUtilization = firstRatio(sources, [
    'creditCardUtilization',
    'credit_card_utilization',
    'utilization',
    'cardUtilization',
  ])

  if (
    creditCardUtilization == null &&
    creditCardDebt != null &&
    creditCardLimit != null &&
    creditCardLimit > 0
  ) {
    creditCardUtilization = creditCardDebt / creditCardLimit
  }

  const rawIncome =
    nestedAmount(familyAnswers, 'financial', 'householdIncome') ??
    nestedAmount(retirementAnswers, 'lifestyle', 'currentAnnualGrossIncome') ??
    firstAmount(sources, ['householdIncome', 'annualHouseholdIncome'])

  // Zero / negative / non-finite income cannot form a valid annual DTI-position ratio.
  const householdIncome =
    rawIncome != null && Number.isFinite(rawIncome) && rawIncome > 0 ? rawIncome : null

  const rawDebt =
    nestedAmount(familyAnswers, 'financial', 'totalDebt') ??
    firstAmount(sources, ['totalDebt', 'total_debt'])

  const totalDebt =
    rawDebt != null && Number.isFinite(rawDebt) && rawDebt >= 0 ? rawDebt : null

  const payoffStrategyRaw = firstString(sources, [
    'debtPayoffStrategy',
    'debt_payoff_strategy',
    'payoffStrategy',
    'hasDebtPayoffPlan',
    'has_debt_payoff_plan',
  ])

  const payoffMethod = firstString(sources, [
    'payoffMethod',
    'debtPayoffMethod',
    'payoff_method',
  ])

  return {
    householdIncome,
    totalDebt,
    creditCardDebt,
    creditCardLimit,
    creditCardUtilization,
    recordedApr: firstApr(sources, [
      'apr',
      'APR',
      'creditCardApr',
      'credit_card_apr',
      'highInterestApr',
      'interestRate',
      'interest_rate',
    ]),
    highInterestDebt: firstAmount(sources, [
      'highInterestDebt',
      'high_interest_debt',
      'highInterestBalance',
    ]),
    hasHighInterestDebt: yesNoFromString(
      firstString(sources, ['hasHighInterestDebt', 'has_high_interest_debt']),
    ),
    debtBurden: nestedString(retirementAnswers, 'lifestyle', 'debtBurden'),
    payoffStrategyAnswer: yesNoFromString(payoffStrategyRaw),
    payoffStrategyLabel: payoffStrategyRaw,
    payoffMethod,
    targetPayment: firstAmount(sources, ['targetPayment', 'target_payment', 'payoffTargetPayment']),
    payoffOrder: firstString(sources, ['payoffOrder', 'payoff_order', 'debtPayoffOrder']),
    debtRelatedTaskTitles: collectDebtRelatedTaskTitles(input.openTasks),
  }
}
