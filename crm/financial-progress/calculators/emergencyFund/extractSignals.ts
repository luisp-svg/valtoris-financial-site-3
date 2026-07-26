import type { HouseholdFinancialProgressInput } from '../../types'

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

function parseNonNegativeAmount(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

function nestedString(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): string | null {
  const sectionRecord = asRecord(answers?.[section])
  return asString(sectionRecord?.[field])
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

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase()
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'dedicated' ||
    normalized === 'separate' ||
    normalized === 'active' ||
    normalized === 'enabled' ||
    normalized === 'automated'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'not-dedicated' ||
    normalized === 'commingled' ||
    normalized === 'inactive' ||
    normalized === 'disabled' ||
    normalized === 'none'
  ) {
    return 'no'
  }
  return null
}

export type EmergencyLiquidityLevel = 'liquid' | 'mixed' | 'illiquid'

function parseLiquidity(value: string | null): EmergencyLiquidityLevel | null {
  if (value == null) return null
  const normalized = value.toLowerCase().replace(/[_-]/g, ' ')
  if (
    normalized === 'liquid' ||
    normalized === 'readily liquid' ||
    normalized === 'fully liquid' ||
    normalized === 'cash' ||
    normalized === 'checking' ||
    normalized === 'savings' ||
    normalized === 'high yield savings' ||
    normalized === 'money market' ||
    normalized === 'cash equivalents'
  ) {
    return 'liquid'
  }
  if (normalized === 'mixed' || normalized === 'partial' || normalized === 'partially liquid') {
    return 'mixed'
  }
  if (
    normalized === 'illiquid' ||
    normalized === 'not liquid' ||
    normalized === 'retirement' ||
    normalized === 'restricted' ||
    normalized === 'long term' ||
    normalized === 'home equity' ||
    normalized === 'vehicles'
  ) {
    return 'illiquid'
  }
  return null
}

/**
 * Parses months coverage. Accepts whole/fractional months from derived metrics
 * or assessment answers. Rejects negative and non-finite values.
 */
export function parseMonths(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

export type EmergencyFundSignals = {
  /**
   * Months of essential expenses covered.
   * Prefer recorded emergencyFundMonths; else savings ÷ monthly essential expenses.
   */
  emergencyFundMonths: number | null
  monthsSource: 'recorded' | 'calculated' | null
  emergencySavings: number | null
  monthlyEssentialExpenses: number | null
  /** Explicit designation that reserves are for emergencies. */
  dedicatedEmergencyFund: 'yes' | 'no' | null
  /** Cash/savings balance alone — never proves dedication. */
  genericCashBalance: number | null
  liquidity: EmergencyLiquidityLevel | null
  automaticEmergencySavings: 'yes' | 'no' | null
  /** True when only a generic savings task exists (not proof of automation). */
  hasGenericSavingsTask: boolean
}

function resolveMonthsFromSavingsAndExpenses(
  savings: number | null,
  monthlyExpenses: number | null,
  annualExpenses: number | null,
): { months: number | null; monthly: number | null } {
  let monthly = monthlyExpenses
  if (monthly == null && annualExpenses != null && annualExpenses > 0) {
    monthly = annualExpenses / 12
  }

  if (savings == null || monthly == null) return { months: null, monthly }
  if (!Number.isFinite(savings) || !Number.isFinite(monthly)) return { months: null, monthly }
  if (savings < 0 || monthly < 0) return { months: null, monthly }
  // Zero expenses cannot produce a valid months ratio without fabricating expenses.
  if (monthly === 0) return { months: null, monthly: 0 }

  return { months: savings / monthly, monthly }
}

/**
 * Extracts emergency-fund signals from existing household assessments / derived metrics.
 * Never estimates savings or expenses.
 */
export function extractEmergencyFundSignals(
  input: HouseholdFinancialProgressInput,
): EmergencyFundSignals {
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

  const recordedMonths =
    parseMonths(nestedString(familyAnswers, 'financial', 'emergencyFundMonths')) ??
    parseMonths(firstString(sources, ['emergencyFundMonths', 'emergency_fund_months'])) ??
    firstAmount(sources, ['emergencyFundMonths', 'emergency_fund_months'])

  const emergencySavings = firstAmount(sources, [
    'emergencySavings',
    'emergency_savings',
    'emergencyReserveBalance',
    'emergencyFundBalance',
  ])

  const monthlyEssentialExpenses = firstAmount(sources, [
    'monthlyEssentialExpenses',
    'monthly_essential_expenses',
    'essentialMonthlyExpenses',
  ])

  const annualEssentialExpenses = firstAmount(sources, [
    'annualEssentialExpenses',
    'annual_essential_expenses',
    'essentialAnnualExpenses',
  ])

  const calculated = resolveMonthsFromSavingsAndExpenses(
    emergencySavings,
    monthlyEssentialExpenses,
    annualEssentialExpenses,
  )

  let emergencyFundMonths: number | null = null
  let monthsSource: EmergencyFundSignals['monthsSource'] = null
  if (recordedMonths != null && Number.isFinite(recordedMonths)) {
    emergencyFundMonths = recordedMonths
    monthsSource = 'recorded'
  } else if (calculated.months != null) {
    emergencyFundMonths = calculated.months
    monthsSource = 'calculated'
  }

  const dedicatedRaw = firstString(sources, [
    'dedicatedEmergencyFund',
    'dedicated_emergency_fund',
    'hasDedicatedEmergencyFund',
    'hasDedicatedEmergencyAccount',
    'emergencyFundDedicated',
  ])

  const liquidityRaw = firstString(sources, [
    'emergencyFundLiquidity',
    'emergency_fund_liquidity',
    'emergencyReserveLiquidity',
    'liquidityOfEmergencyAssets',
  ])

  const automaticRaw = firstString(sources, [
    'automaticEmergencySavings',
    'automatic_emergency_savings',
    'hasAutomaticEmergencySavings',
    'emergencySavingsAutomated',
    'recurringEmergencyTransfer',
  ])

  const genericCashBalance = firstAmount(sources, [
    'checkingBalance',
    'savingsBalance',
    'cashBalance',
    'bankBalance',
  ])

  const hasGenericSavingsTask = (input.openTasks ?? []).some((task) => {
    const title = task.title.toLowerCase()
    return (
      (title.includes('savings') || title.includes('save')) &&
      !title.includes('automatic') &&
      !title.includes('recurring') &&
      !title.includes('automate') &&
      !title.includes('emergency')
    )
  })

  return {
    emergencyFundMonths,
    monthsSource,
    emergencySavings,
    monthlyEssentialExpenses: calculated.monthly ?? monthlyEssentialExpenses,
    dedicatedEmergencyFund: yesNoFromString(dedicatedRaw),
    genericCashBalance,
    liquidity: parseLiquidity(liquidityRaw),
    automaticEmergencySavings: yesNoFromString(automaticRaw),
    hasGenericSavingsTask,
  }
}
