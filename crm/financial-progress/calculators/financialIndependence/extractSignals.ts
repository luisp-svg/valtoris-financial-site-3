import type { HouseholdFinancialProgressInput } from '../../types'
import {
  FI_ELIGIBLE_ASSET_TOTAL_ALIASES,
  FI_GOAL_NARRATIVE_ALIASES,
  FI_GOAL_YES_ALIASES,
  FI_PLAN_REVIEW_CURRENT_MONTHS,
  FI_STRATEGY_YES_ALIASES,
  FI_TARGET_ALIASES,
  FI_TARGET_CONFLICT_TOLERANCE_PERCENT,
  FI_WITHDRAWAL_RATE_DECIMAL_ALIASES,
  FI_WITHDRAWAL_RATE_EQUIVALENCE_EPSILON,
  FI_WITHDRAWAL_RATE_GENERIC_ALIASES,
  FI_WITHDRAWAL_RATE_PERCENT_ALIASES,
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

function parseNonNegative(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

function parsePositive(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed <= 0) return null
  return parsed
}

export type WithdrawalRateParseResult =
  | { status: 'ok'; rate: number }
  | { status: 'invalid' }
  | { status: 'ambiguous' }
  | { status: 'missing' }

/** Validates a normalized decimal withdrawal rate in (0, 1]. */
export function isValidNormalizedWithdrawalRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0 && rate <= 1
}

/**
 * Decimal-semantic fields (e.g. fiWithdrawalRateDecimal = 0.04).
 * Interprets the value directly as a decimal rate; does not divide by 100.
 */
export function parseDecimalWithdrawalRate(value: unknown): WithdrawalRateParseResult {
  if (value == null || value === '') return { status: 'missing' }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return { status: 'invalid' }
    if (!isValidNormalizedWithdrawalRate(value)) return { status: 'invalid' }
    return { status: 'ok', rate: value }
  }
  if (typeof value !== 'string') return { status: 'invalid' }
  const trimmed = value.trim()
  if (trimmed === '') return { status: 'missing' }
  if (trimmed.includes('%')) return { status: 'invalid' }
  const parsed = Number.parseFloat(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(parsed) || parsed <= 0) return { status: 'invalid' }
  if (!isValidNormalizedWithdrawalRate(parsed)) return { status: 'invalid' }
  return { status: 'ok', rate: parsed }
}

/**
 * Percentage-semantic fields (e.g. fiWithdrawalRatePercent = 4).
 * Converts percent → decimal (4 → 0.04). Rejects values above 100%.
 */
export function parsePercentWithdrawalRate(value: unknown): WithdrawalRateParseResult {
  if (value == null || value === '') return { status: 'missing' }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return { status: 'invalid' }
    if (value > 100) return { status: 'invalid' }
    const rate = value / 100
    if (!isValidNormalizedWithdrawalRate(rate)) return { status: 'invalid' }
    return { status: 'ok', rate }
  }
  if (typeof value !== 'string') return { status: 'invalid' }
  const trimmed = value.trim()
  if (trimmed === '') return { status: 'missing' }
  const cleaned = trimmed.replace(/%/g, '').replace(/,/g, '').trim()
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return { status: 'invalid' }
  const rate = parsed / 100
  if (!isValidNormalizedWithdrawalRate(rate)) return { status: 'invalid' }
  return { status: 'ok', rate }
}

/**
 * Generic / unlabeled rate fields (fiWithdrawalRate, withdrawalRate).
 * - decimal number/string in (0, 1] → accepted
 * - explicit "N%" string → accepted as percent
 * - unlabeled magnitude such as 4 or "4" → ambiguous (not guessed)
 */
export function parseGenericWithdrawalRate(value: unknown): WithdrawalRateParseResult {
  if (value == null || value === '') return { status: 'missing' }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return { status: 'invalid' }
    if (value > 1) return { status: 'ambiguous' }
    return { status: 'ok', rate: value }
  }
  if (typeof value !== 'string') return { status: 'invalid' }
  const trimmed = value.trim()
  if (trimmed === '') return { status: 'missing' }
  const hasPercent = trimmed.includes('%')
  const cleaned = trimmed.replace(/%/g, '').replace(/,/g, '').trim()
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) return { status: 'invalid' }
  if (hasPercent) {
    if (parsed > 100) return { status: 'invalid' }
    const rate = parsed / 100
    if (!isValidNormalizedWithdrawalRate(rate)) return { status: 'invalid' }
    return { status: 'ok', rate }
  }
  if (parsed > 1) return { status: 'ambiguous' }
  if (!isValidNormalizedWithdrawalRate(parsed)) return { status: 'invalid' }
  return { status: 'ok', rate: parsed }
}

/** @deprecated Prefer unit-specific parsers; retained for focused unit tests. */
export function parseWithdrawalRate(value: unknown): number | null {
  const result = parseGenericWithdrawalRate(value)
  return result.status === 'ok' ? result.rate : null
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase().replace(/[_-]/g, ' ')
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'documented' ||
    normalized === 'defined' ||
    normalized === 'active' ||
    normalized === 'current' ||
    normalized === 'ongoing' ||
    normalized === 'completed'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'none' ||
    normalized === 'not documented' ||
    normalized === 'undefined' ||
    normalized === 'inactive' ||
    normalized === 'outdated'
  ) {
    return 'no'
  }
  return null
}

const FI_NESTED_SECTIONS = [
  'financialIndependence',
  'financial_independence',
  'fi',
  'independence',
  'financial',
  'retirement',
  'savings',
  'lifestyle',
  'vision',
  'household',
  'plan',
] as const

function collectStrings(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string[] {
  if (!source) return []
  const found: string[] = []
  for (const key of keys) {
    const direct = asString(source[key])
    if (direct) found.push(direct)
    for (const section of FI_NESTED_SECTIONS) {
      const nested = asRecord(source[section])
      if (!nested) continue
      const value = asString(nested[key])
      if (value) found.push(value)
    }
  }
  return found
}

function collectNumbers(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  parse: (value: unknown) => number | null,
): number[] {
  if (!source) return []
  const found: number[] = []
  for (const key of keys) {
    const direct = parse(source[key])
    if (direct != null) found.push(direct)
    for (const section of FI_NESTED_SECTIONS) {
      const nested = asRecord(source[section])
      if (!nested) continue
      const value = parse(nested[key])
      if (value != null) found.push(value)
    }
  }
  return found
}

function buildPrecedenceSources(
  input: HouseholdFinancialProgressInput,
): Array<Record<string, unknown> | null | undefined> {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const protectionAnswers = input.assessments?.protection?.answers ?? null

  const fiSections = [
    asRecord(familyAnswers?.financialIndependence),
    asRecord(familyAnswers?.financial_independence),
    asRecord(familyAnswers?.fi),
    asRecord(retirementAnswers?.financialIndependence),
    asRecord(retirementAnswers?.financial_independence),
    asRecord(retirementAnswers?.fi),
  ]

  const derived = [
    input.assessments?.family?.derived_metrics,
    input.assessments?.retirement?.derived_metrics,
    input.assessments?.protection?.derived_metrics,
  ]

  const planSections = derived.flatMap((metrics) => {
    if (!metrics) return []
    return [
      asRecord(metrics.financialPlan),
      asRecord(metrics.fiPlan),
      asRecord(metrics.independencePlan),
    ]
  })

  return [
    ...fiSections,
    ...derived,
    ...planSections,
    familyAnswers,
    retirementAnswers,
    protectionAnswers,
  ]
}

function firstString(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): string | null {
  for (const source of sources) {
    const values = collectStrings(source, keys)
    if (values.length > 0) return values[0]!
  }
  return null
}

function allNumbers(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
  parse: (value: unknown) => number | null = parseNonNegative,
): number[] {
  const values: number[] = []
  for (const source of sources) {
    values.push(...collectNumbers(source, keys, parse))
  }
  return values
}

function firstNumber(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
  parse: (value: unknown) => number | null = parseNonNegative,
): number | null {
  const values = allNumbers(sources, keys, parse)
  return values.length > 0 ? values[0]! : null
}

function allYesNo(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): Array<'yes' | 'no'> {
  const votes: Array<'yes' | 'no'> = []
  for (const source of sources) {
    for (const raw of collectStrings(source, keys)) {
      const vote = yesNoFromString(raw)
      if (vote) votes.push(vote)
    }
    if (!source) continue
    for (const key of keys) {
      if (typeof source[key] === 'boolean') votes.push(source[key] ? 'yes' : 'no')
      for (const section of FI_NESTED_SECTIONS) {
        const nested = asRecord(source[section])
        if (!nested) continue
        if (typeof nested[key] === 'boolean') votes.push(nested[key] ? 'yes' : 'no')
      }
    }
  }
  return votes
}

function resolveYesNo(
  votes: Array<'yes' | 'no'>,
): 'yes' | 'no' | 'conflict' | 'unknown' {
  if (votes.length === 0) return 'unknown'
  const hasYes = votes.includes('yes')
  const hasNo = votes.includes('no')
  if (hasYes && hasNo) return 'conflict'
  if (hasYes) return 'yes'
  return 'no'
}

export function monthsBetween(earlierIso: string, laterIso: string): number | null {
  const earlier = new Date(earlierIso)
  const later = new Date(laterIso)
  if (Number.isNaN(earlier.getTime()) || Number.isNaN(later.getTime())) return null
  if (earlier.getTime() > later.getTime()) return null
  const years = later.getUTCFullYear() - earlier.getUTCFullYear()
  const months = later.getUTCMonth() - earlier.getUTCMonth()
  const days = later.getUTCDate() - earlier.getUTCDate()
  let total = years * 12 + months
  if (days < 0) total -= 1
  return total
}

function relativeConflictPercent(a: number, b: number): number {
  const baseline = Math.max(Math.abs(a), Math.abs(b), 1)
  return (Math.abs(a - b) / baseline) * 100
}

function ratesAreEquivalent(a: number, b: number): boolean {
  return Math.abs(a - b) <= FI_WITHDRAWAL_RATE_EQUIVALENCE_EPSILON
}

function collectRawFieldValues(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): unknown[] {
  const values: unknown[] = []
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        values.push(source[key])
      }
      for (const section of FI_NESTED_SECTIONS) {
        const nested = asRecord(source[section])
        if (!nested) continue
        if (nested[key] !== undefined && nested[key] !== null && nested[key] !== '') {
          values.push(nested[key])
        }
      }
    }
  }
  return values
}

type WithdrawalRateResolution =
  | { status: 'ok'; rate: number; notes: string[] }
  | { status: 'missing'; notes: string[] }
  | { status: 'ambiguous'; notes: string[] }
  | { status: 'invalid'; notes: string[] }
  | { status: 'conflict'; notes: string[] }

/**
 * Collects and normalizes withdrawal rates from unit-specific and generic fields.
 * Equivalent normalized rates dedupe; material differences conflict.
 */
export function resolveWithdrawalRate(
  sources: Array<Record<string, unknown> | null | undefined>,
): WithdrawalRateResolution {
  const notes: string[] = []
  const normalized: number[] = []
  let sawAmbiguous = false
  let sawInvalid = false

  for (const value of collectRawFieldValues(sources, [...FI_WITHDRAWAL_RATE_DECIMAL_ALIASES])) {
    const parsed = parseDecimalWithdrawalRate(value)
    if (parsed.status === 'ok') {
      normalized.push(parsed.rate)
      notes.push('Withdrawal rate read from decimal-semantic field.')
    } else if (parsed.status === 'invalid') {
      sawInvalid = true
    }
  }

  for (const value of collectRawFieldValues(sources, [...FI_WITHDRAWAL_RATE_PERCENT_ALIASES])) {
    const parsed = parsePercentWithdrawalRate(value)
    if (parsed.status === 'ok') {
      normalized.push(parsed.rate)
      notes.push('Withdrawal rate read from percentage-semantic field and normalized to decimal.')
    } else if (parsed.status === 'invalid') {
      sawInvalid = true
    }
  }

  for (const value of collectRawFieldValues(sources, [...FI_WITHDRAWAL_RATE_GENERIC_ALIASES])) {
    const parsed = parseGenericWithdrawalRate(value)
    if (parsed.status === 'ok') {
      normalized.push(parsed.rate)
      notes.push(
        'Withdrawal rate read from generic field only because the value is an unambiguous decimal or percent string.',
      )
    } else if (parsed.status === 'ambiguous') {
      sawAmbiguous = true
    } else if (parsed.status === 'invalid') {
      sawInvalid = true
    }
  }

  if (normalized.length === 0) {
    if (sawAmbiguous) {
      return {
        status: 'ambiguous',
        notes: [
          ...notes,
          'Withdrawal-rate unit is ambiguous (for example, an unlabeled numeric value such as 4). Confirm whether the rate is a decimal or a percent before deriving a target.',
        ],
      }
    }
    if (sawInvalid) {
      return {
        status: 'invalid',
        notes: [
          ...notes,
          'Recorded withdrawal rate is invalid (zero, negative, non-finite, above 100%, or malformed).',
        ],
      }
    }
    return { status: 'missing', notes }
  }

  const unique: number[] = []
  for (const rate of normalized) {
    if (!unique.some((existing) => ratesAreEquivalent(existing, rate))) {
      unique.push(rate)
    }
  }

  if (unique.length > 1) {
    return {
      status: 'conflict',
      notes: [
        ...notes,
        'Materially different normalized withdrawal-rate values conflict; the target is not derived.',
      ],
    }
  }

  // Explicit unit fields take precedence over ambiguous generics when an authoritative rate exists.
  if (sawAmbiguous) {
    notes.push(
      'An ambiguous generic withdrawal-rate value was ignored because an authoritative unit-specific or unambiguous rate was available.',
    )
  }
  if (sawInvalid) {
    notes.push(
      'An invalid alternate withdrawal-rate value was ignored because a valid authoritative rate was available.',
    )
  }

  return { status: 'ok', rate: unique[0]!, notes }
}

function isVagueGoalText(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[_-]/g, ' ')
  const vagueExact = [
    'save more',
    'wants to save more',
    'be wealthy',
    'wants to be wealthy',
    'better future',
    'wants a better future',
    'build wealth',
    'get rich',
  ]
  if (vagueExact.some((item) => normalized === item || normalized.includes(item))) {
    // Allow if also contains clearer FI language.
    if (
      normalized.includes('financial independence') ||
      normalized.includes('work optional') ||
      normalized.includes('passive income') ||
      normalized.includes('retire')
    ) {
      return false
    }
    return true
  }
  return false
}

function isDefinedGoalNarrative(text: string): boolean {
  if (isVagueGoalText(text)) return false
  const normalized = text.toLowerCase()
  return (
    normalized.includes('financial independence') ||
    normalized.includes('work optional') ||
    normalized.includes('work-optional') ||
    normalized.includes('passive income') ||
    normalized.includes('lifestyle income') ||
    normalized.includes('independence') ||
    (normalized.includes('retire') &&
      (normalized.includes('age') ||
        normalized.includes('goal') ||
        normalized.includes('lifestyle') ||
        normalized.length > 20))
  )
}

export type GoalDefinitionLevel = 'defined' | 'vague' | 'none' | 'conflict' | 'unknown'

export type TargetSignal = {
  amount: number | null
  source: 'explicit' | 'derived' | 'none'
  status: 'present' | 'none' | 'conflict' | 'incomplete' | 'invalid'
  assumptions: string[]
  notes: string[]
}

export type AssetSignal = {
  amount: number | null
  status: 'present' | 'zero' | 'conflict' | 'incomplete' | 'invalid' | 'unknown'
  sources: string[]
  includesDesignatedHomeEquity: boolean
  notes: string[]
}

export type StrategyLevel =
  | 'active'
  | 'outdated'
  | 'none'
  | 'conflict'
  | 'unknown'
  | 'untied_retirement_only'

export type FinancialIndependenceSignals = {
  goal: GoalDefinitionLevel
  goalNotes: string[]

  target: TargetSignal
  assets: AssetSignal

  strategy: StrategyLevel
  strategyNotes: string[]

  asOfProvided: boolean
  referenceDateIso: string
}

function assessGoal(
  sources: Array<Record<string, unknown> | null | undefined>,
  input: HouseholdFinancialProgressInput,
): { level: GoalDefinitionLevel; notes: string[] } {
  const notes: string[] = []
  const flag = resolveYesNo(allYesNo(sources, [...FI_GOAL_YES_ALIASES]))
  if (flag === 'conflict') {
    return {
      level: 'conflict',
      notes: ['Conflicting defined / not-defined financial-independence goal statuses.'],
    }
  }
  if (flag === 'yes') {
    notes.push('Authoritative flag documents a financial-independence objective.')
    return { level: 'defined', notes }
  }
  if (flag === 'no') {
    return { level: 'none', notes: ['Available data explicitly reports no defined FI goal.'] }
  }

  const narrative = firstString(sources, [...FI_GOAL_NARRATIVE_ALIASES])
  if (narrative) {
    if (isVagueGoalText(narrative)) {
      return {
        level: 'vague',
        notes: [`Recorded goal text is too vague to establish a defined FI outcome: "${narrative}".`],
      }
    }
    if (isDefinedGoalNarrative(narrative)) {
      notes.push('Documented FI / work-optional / passive-income objective narrative is present.')
      return { level: 'defined', notes }
    }
  }

  const lifestyleIncome = firstNumber(
    sources,
    [
      'desiredLifestyleIncome',
      'desired_lifestyle_income',
      'desiredAnnualLifestyleIncome',
      'desired_annual_lifestyle_income',
      'desiredMonthlyLifestyleIncome',
      'desired_monthly_lifestyle_income',
    ],
    parsePositive,
  )
  if (lifestyleIncome != null) {
    notes.push('Desired future lifestyle income is documented as an FI objective.')
    return { level: 'defined', notes }
  }

  const fiAge = firstNumber(
    sources,
    [
      'financialIndependenceAge',
      'financial_independence_age',
      'desiredFinancialIndependenceAge',
      'workOptionalAge',
      'work_optional_age',
    ],
    parsePositive,
  )
  if (fiAge != null) {
    notes.push('Desired financial-independence / work-optional age is documented.')
    return { level: 'defined', notes }
  }

  // Retirement age alone is not enough unless explicitly tied to FI.
  const retirementAge = firstNumber(
    sources,
    ['targetRetirementAge', 'target_retirement_age'],
    parsePositive,
  )
  const retirementAgeTiedToFi = resolveYesNo(
    allYesNo(sources, [
      'retirementAgeTiedToFi',
      'retirement_age_tied_to_fi',
      'targetRetirementAgeIsFiGoal',
    ]),
  )
  if (retirementAge != null && retirementAgeTiedToFi === 'yes') {
    notes.push('Desired retirement age is explicitly tied to the financial-independence goal.')
    return { level: 'defined', notes }
  }
  if (retirementAge != null) {
    notes.push(
      'A target retirement age is present without clear financial-independence context; it does not alone define an FI goal.',
    )
  }

  // Non-proof signals
  const hasContribution =
    firstNumber(sources, ['retirementContributionRate', 'monthlyRetirementContribution']) !=
      null ||
    firstString(sources, ['retirementContribution']) != null
  if (hasContribution) {
    notes.push('Retirement contributions alone do not establish a defined FI goal.')
  }

  const hasTask = (input.openTasks ?? []).some((task) => {
    const title = task.title.toLowerCase()
    return title.includes('retire') || title.includes('independence') || title.includes('fi ')
  })
  if (hasTask) {
    notes.push('A generic task title does not establish a defined FI goal.')
  }

  return { level: 'unknown', notes }
}

function assessTarget(
  sources: Array<Record<string, unknown> | null | undefined>,
): TargetSignal {
  const notes: string[] = []
  const assumptions: string[] = []

  const noTarget = resolveYesNo(
    allYesNo(sources, [
      'hasFinancialIndependenceTarget',
      'has_financial_independence_target',
      'fiTargetEstablished',
      'fi_target_established',
    ]),
  )
  if (noTarget === 'no') {
    return {
      amount: null,
      source: 'none',
      status: 'none',
      assumptions,
      notes: ['Available data explicitly reports that no FI target has been established.'],
    }
  }

  const explicitValues = allNumbers(sources, [...FI_TARGET_ALIASES], parseFiniteNumber)
  const positiveExplicit = explicitValues.filter((value) => value > 0)
  const nonPositive = explicitValues.filter((value) => value <= 0)

  if (nonPositive.length > 0 && positiveExplicit.length === 0) {
    return {
      amount: null,
      source: 'none',
      status: 'invalid',
      assumptions,
      notes: ['Recorded FI target is zero, negative, or otherwise invalid.'],
    }
  }

  if (positiveExplicit.length >= 2) {
    const first = positiveExplicit[0]!
    const conflict = positiveExplicit.some(
      (value) => relativeConflictPercent(first, value) > FI_TARGET_CONFLICT_TOLERANCE_PERCENT,
    )
    if (conflict) {
      return {
        amount: null,
        source: 'none',
        status: 'conflict',
        assumptions,
        notes: [
          'Materially conflicting explicit financial-independence target amounts prevent scoring.',
        ],
      }
    }
  }

  const explicitTarget = positiveExplicit.length > 0 ? positiveExplicit[0]! : null
  if (explicitTarget != null) {
    notes.push('Explicit authoritative FI / retirement-asset target amount is documented.')
  }

  // Permitted derivation: desired annual income ÷ explicit withdrawal rate (no defaults).
  const annualIncome = firstNumber(
    sources,
    [
      'desiredAnnualFiIncome',
      'desired_annual_fi_income',
      'desiredAnnualIndependenceIncome',
      'desired_annual_independence_income',
      'fiDesiredAnnualIncome',
    ],
    parsePositive,
  )
  const monthlyIncome = firstNumber(
    sources,
    [
      'desiredMonthlyFiIncome',
      'desired_monthly_fi_income',
      'desiredMonthlyIndependenceIncome',
    ],
    parsePositive,
  )
  const incomeUnit = firstString(sources, [
    'fiDesiredIncomeUnit',
    'fi_desired_income_unit',
    'desiredFiIncomeUnit',
  ])
  const withdrawalResolution = resolveWithdrawalRate(sources)
  notes.push(...withdrawalResolution.notes)

  if (withdrawalResolution.status === 'conflict') {
    return {
      amount: null,
      source: 'none',
      status: 'conflict',
      assumptions,
      notes: [
        ...notes,
        'Conflicting withdrawal-rate fields create a target-input conflict; the target is not scored.',
      ],
    }
  }

  if (
    withdrawalResolution.status === 'ambiguous' ||
    withdrawalResolution.status === 'invalid'
  ) {
    if (explicitTarget == null) {
      return {
        amount: null,
        source: 'none',
        status: 'incomplete',
        assumptions,
        notes: [
          ...notes,
          withdrawalResolution.status === 'ambiguous'
            ? 'The withdrawal-rate unit needs confirmation before a target can be derived.'
            : 'Invalid withdrawal-rate evidence prevents target derivation.',
        ],
      }
    }
    notes.push(
      'Target derivation from income÷withdrawal rate was not used because the withdrawal-rate unit or value could not be confirmed; the explicit stored target is used.',
    )
  }

  const withdrawalRate =
    withdrawalResolution.status === 'ok' ? withdrawalResolution.rate : null

  let derivedTarget: number | null = null
  if (annualIncome != null && withdrawalRate != null) {
    derivedTarget = annualIncome / withdrawalRate
    assumptions.push(
      'The recorded target was derived using the household’s explicitly provided annual income objective and withdrawal-rate assumption.',
    )
  } else if (monthlyIncome != null && withdrawalRate != null) {
    if (incomeUnit === 'monthly' || incomeUnit == null) {
      // Monthly is accepted only when unit is monthly or when the field name is monthly.
      derivedTarget = (monthlyIncome * 12) / withdrawalRate
      assumptions.push(
        'The recorded target was derived using the household’s explicitly provided monthly income objective (annualized from field semantics) and withdrawal-rate assumption.',
      )
      if (incomeUnit == null) {
        notes.push('Monthly FI income field used; unit inferred from field semantics.')
      }
    } else if (incomeUnit === 'annual') {
      return {
        amount: null,
        source: 'none',
        status: 'incomplete',
        assumptions,
        notes: [
          'Ambiguous income unit: monthly-named field labeled annual. Target assumptions cannot be scored.',
        ],
      }
    }
  } else if (
    (annualIncome != null || monthlyIncome != null) &&
    withdrawalRate == null &&
    explicitTarget == null
  ) {
    return {
      amount: null,
      source: 'none',
      status: 'incomplete',
      assumptions,
      notes: [
        'Desired FI income is recorded without an explicit, unit-confirmed withdrawal rate. No default rate is assumed.',
      ],
    }
  } else if (
    withdrawalRate != null &&
    annualIncome == null &&
    monthlyIncome == null &&
    explicitTarget == null
  ) {
    return {
      amount: null,
      source: 'none',
      status: 'incomplete',
      assumptions,
      notes: [
        'Withdrawal rate is recorded without desired income. No 25× expenses rule is applied.',
      ],
    }
  }

  if (explicitTarget != null && derivedTarget != null) {
    if (
      relativeConflictPercent(explicitTarget, derivedTarget) > FI_TARGET_CONFLICT_TOLERANCE_PERCENT
    ) {
      return {
        amount: null,
        source: 'none',
        status: 'conflict',
        assumptions,
        notes: [
          ...notes,
          'Explicit FI target materially disagrees with the derived income÷withdrawal target.',
          ...assumptions,
        ],
      }
    }
    return {
      amount: explicitTarget,
      source: 'explicit',
      status: 'present',
      assumptions,
      notes: [
        ...notes,
        'Derived target is consistent with the explicit target within tolerance; explicit target is used.',
      ],
    }
  }

  if (explicitTarget != null) {
    return {
      amount: explicitTarget,
      source: 'explicit',
      status: 'present',
      assumptions,
      notes,
    }
  }

  if (derivedTarget != null) {
    return {
      amount: derivedTarget,
      source: 'derived',
      status: 'present',
      assumptions,
      notes: [...notes, ...assumptions],
    }
  }

  return {
    amount: null,
    source: 'none',
    status: 'incomplete',
    assumptions,
    notes: [
      'No authoritative financial-independence target amount is recorded. 25× expenses and 4% defaults are not applied.',
    ],
  }
}

function assessAssets(
  sources: Array<Record<string, unknown> | null | undefined>,
): AssetSignal {
  const notes: string[] = []
  const usedSources: string[] = []

  const explicitTotals = allNumbers(sources, [...FI_ELIGIBLE_ASSET_TOTAL_ALIASES], parseFiniteNumber)
  if (explicitTotals.some((value) => value < 0)) {
    return {
      amount: null,
      status: 'invalid',
      sources: [],
      includesDesignatedHomeEquity: false,
      notes: ['Negative eligible FI assets are invalid for this methodology.'],
    }
  }

  if (explicitTotals.length >= 2) {
    const first = explicitTotals[0]!
    if (
      explicitTotals.some(
        (value) => relativeConflictPercent(first, value) > FI_TARGET_CONFLICT_TOLERANCE_PERCENT,
      )
    ) {
      return {
        amount: null,
        status: 'conflict',
        sources: [],
        includesDesignatedHomeEquity: false,
        notes: ['Materially conflicting FI-eligible asset totals prevent scoring.'],
      }
    }
  }

  if (explicitTotals.length > 0) {
    usedSources.push('explicit_fi_eligible_total')
    notes.push('Explicit FI-eligible / investable-asset total is used.')
    return {
      amount: explicitTotals[0]!,
      status: explicitTotals[0]! === 0 ? 'zero' : 'present',
      sources: usedSources,
      includesDesignatedHomeEquity: false,
      notes,
    }
  }

  // Component path — exclude emergency, home equity (unless designated), etc.
  const retirementAssets = firstNumber(
    sources,
    [
      'totalRetirementAssets',
      'total_retirement_assets',
      'currentRetirementSavings',
      'current_retirement_savings',
      'retirementAssets',
    ],
    parseNonNegative,
  )
  const accountSum = firstNumber(
    sources,
    ['sumOfRetirementAccountBalances', 'retirementAccountBalanceSum'],
    parseNonNegative,
  )
  // Deduplicate: prefer aggregate total; ignore account sum when aggregate exists.
  let retirementComponent: number | null = null
  if (retirementAssets != null && accountSum != null) {
    if (relativeConflictPercent(retirementAssets, accountSum) > FI_TARGET_CONFLICT_TOLERANCE_PERCENT) {
      return {
        amount: null,
        status: 'conflict',
        sources: [],
        includesDesignatedHomeEquity: false,
        notes: [
          'Aggregate retirement assets materially disagree with account-level balances.',
        ],
      }
    }
    retirementComponent = retirementAssets
    usedSources.push('retirement_assets_aggregate')
    notes.push('Account-level retirement balances were not double-counted against the aggregate.')
  } else if (retirementAssets != null) {
    retirementComponent = retirementAssets
    usedSources.push('retirement_assets_aggregate')
  } else if (accountSum != null) {
    retirementComponent = accountSum
    usedSources.push('retirement_account_sum')
  }

  const taxable = firstNumber(
    sources,
    [
      'taxableInvestmentAssets',
      'taxable_investment_assets',
      'brokerageAssetsForFi',
      'brokerage_assets_for_fi',
    ],
    parseNonNegative,
  )
  if (taxable != null) {
    usedSources.push('taxable_investments')
  }

  const designatedCash = firstNumber(
    sources,
    [
      'designatedFiCash',
      'designated_fi_cash',
      'longTermFiCash',
      'long_term_fi_cash',
    ],
    parseNonNegative,
  )
  if (designatedCash != null) {
    usedSources.push('designated_fi_cash')
    notes.push('Cash is included only because it is explicitly designated for long-term FI investing.')
  }

  const designatedHomeEquity = firstNumber(
    sources,
    [
      'designatedHomeEquityForFi',
      'designated_home_equity_for_fi',
      'fiDesignatedHomeEquity',
    ],
    parseNonNegative,
  )
  let includesDesignatedHomeEquity = false
  if (designatedHomeEquity != null) {
    includesDesignatedHomeEquity = true
    usedSources.push('designated_home_equity')
    notes.push(
      'Primary-home equity is included only because an authoritative field explicitly designates a recorded amount for the FI strategy.',
    )
  }

  // Explicit exclusions — never add these even if present.
  const emergency = firstNumber(sources, ['emergencyFundBalance', 'emergency_fund_balance'])
  if (emergency != null) {
    notes.push('Emergency-fund cash is excluded from eligible FI assets.')
  }
  const homeEquity = firstNumber(sources, ['homeEquity', 'home_equity', 'primaryHomeEquity'])
  if (homeEquity != null && designatedHomeEquity == null) {
    notes.push('Primary-home equity is present but excluded by default (not designated for FI).')
  }
  const netWorth = firstNumber(sources, ['netWorth', 'net_worth', 'totalNetWorth'])
  if (netWorth != null) {
    notes.push('Generic net worth is not used as eligible FI assets.')
  }

  const components = [retirementComponent, taxable, designatedCash, designatedHomeEquity].filter(
    (value): value is number => value != null,
  )

  if (components.length === 0) {
    return {
      amount: null,
      status: 'unknown',
      sources: [],
      includesDesignatedHomeEquity: false,
      notes: [
        ...notes,
        'No authoritative eligible FI asset total or component balances are recorded.',
      ],
    }
  }

  const total = components.reduce((sum, value) => sum + value, 0)
  return {
    amount: total,
    status: total === 0 ? 'zero' : 'present',
    sources: usedSources,
    includesDesignatedHomeEquity,
    notes,
  }
}

function assessStrategy(
  sources: Array<Record<string, unknown> | null | undefined>,
  asOfIso: string,
  asOfProvided: boolean,
): { level: StrategyLevel; notes: string[] } {
  const notes: string[] = [
    `FI plan-review freshness window: ${FI_PLAN_REVIEW_CURRENT_MONTHS} months ending at the injectable reference date.`,
  ]

  const strategyFlag = resolveYesNo(allYesNo(sources, [...FI_STRATEGY_YES_ALIASES]))
  const noStrategy = resolveYesNo(
    allYesNo(sources, [
      'hasFiFundingStrategy',
      'has_fi_funding_strategy',
      'fiStrategyEstablished',
    ]),
  )

  if (strategyFlag === 'conflict' || noStrategy === 'conflict') {
    return {
      level: 'conflict',
      notes: [...notes, 'Conflicting active / no-strategy evidence prevents scoring.'],
    }
  }

  if (noStrategy === 'no' && strategyFlag !== 'yes') {
    return {
      level: 'none',
      notes: [...notes, 'Available data explicitly reports no FI funding strategy or tracking process.'],
    }
  }

  const statusRaw = firstString(sources, [
    'fiStrategyStatus',
    'fi_strategy_status',
    'financialIndependencePlanStatus',
  ])
  const statusNormalized = statusRaw?.toLowerCase().replace(/[_-]/g, ' ') ?? null
  const statusCurrent =
    statusNormalized === 'current' ||
    statusNormalized === 'active' ||
    statusNormalized === 'ongoing'
  const statusOutdated =
    statusNormalized === 'outdated' ||
    statusNormalized === 'stale' ||
    statusNormalized === 'expired'

  const reviewDateRaw = firstString(sources, [
    'fiPlanReviewDate',
    'fi_plan_review_date',
    'financialIndependenceReviewDate',
    'fiStrategyReviewDate',
  ])
  let reviewMonths: number | null = null
  let reviewInvalid = false
  if (reviewDateRaw) {
    const date = new Date(reviewDateRaw)
    if (Number.isNaN(date.getTime())) {
      reviewInvalid = true
    } else if (!asOfProvided) {
      notes.push('A review date is present, but input.asOf is required to evaluate freshness.')
    } else {
      reviewMonths = monthsBetween(date.toISOString(), asOfIso)
    }
  }

  if (reviewInvalid) {
    return {
      level: 'unknown',
      notes: [...notes, 'FI plan-review date is invalid.'],
    }
  }

  if (strategyFlag === 'yes' || statusCurrent) {
    notes.push('Documented FI funding strategy and/or current tracking process is present.')
    return { level: 'active', notes }
  }

  if (reviewMonths != null) {
    if (reviewMonths <= FI_PLAN_REVIEW_CURRENT_MONTHS) {
      notes.push(`FI plan review is within ${FI_PLAN_REVIEW_CURRENT_MONTHS} months.`)
      return { level: 'active', notes }
    }
    notes.push(`FI plan review is older than ${FI_PLAN_REVIEW_CURRENT_MONTHS} months.`)
    return { level: 'outdated', notes }
  }

  if (statusOutdated) {
    return { level: 'outdated', notes: [...notes, 'FI strategy status is explicitly outdated.'] }
  }

  const undatedAdvisor = resolveYesNo(
    allYesNo(sources, [
      'advisorFiDiscussion',
      'advisor_fi_discussion',
      'discussedFiWithAdvisor',
    ]),
  )
  if (undatedAdvisor === 'yes') {
    return {
      level: 'unknown',
      notes: [
        ...notes,
        'An undated advisor discussion does not automatically prove a current FI strategy.',
      ],
    }
  }

  // Generic retirement plan without FI tie-in does not earn the point.
  const retirementPlan = resolveYesNo(
    allYesNo(sources, [
      'hasRetirementPlan',
      'retirementPlanDocumented',
      'has_retirement_plan',
    ]),
  )
  const tiedToFi = resolveYesNo(
    allYesNo(sources, ['retirementPlanTiedToFi', 'retirement_plan_tied_to_fi']),
  )
  if (retirementPlan === 'yes' && tiedToFi === 'yes') {
    notes.push('Retirement plan is explicitly tied to the household FI objective.')
    return { level: 'active', notes }
  }
  if (retirementPlan === 'yes' && tiedToFi !== 'yes') {
    return {
      level: 'untied_retirement_only',
      notes: [
        ...notes,
        'A generic retirement plan is present but is not explicitly tied to the financial-independence objective.',
      ],
    }
  }

  const contributionAlone = firstNumber(sources, [
    'monthlyRetirementContribution',
    'retirementContributionRate',
  ])
  if (contributionAlone != null) {
    notes.push('A contribution amount alone does not prove an FI funding strategy.')
  }

  return {
    level: 'unknown',
    notes: [...notes, 'FI funding strategy / progress-tracking evidence is unknown.'],
  }
}

/**
 * Extracts Financial Independence signals. Does not invent targets, assets, or scores.
 * Date math uses input.asOf only.
 */
export function extractFinancialIndependenceSignals(
  input: HouseholdFinancialProgressInput,
): FinancialIndependenceSignals {
  const sources = buildPrecedenceSources(input)
  const asOfProvided = input.asOf != null && input.asOf.trim() !== ''
  const referenceDateIso = asOfProvided ? input.asOf! : '1970-01-01T00:00:00.000Z'

  const goal = assessGoal(sources, input)
  const target = assessTarget(sources)
  const assets = assessAssets(sources)
  const strategy = assessStrategy(sources, referenceDateIso, asOfProvided)

  return {
    goal: goal.level,
    goalNotes: goal.notes,
    target,
    assets,
    strategy: strategy.level,
    strategyNotes: strategy.notes,
    asOfProvided,
    referenceDateIso,
  }
}
