import type { HouseholdFinancialProgressInput } from '../../types'
import { parseRate } from '../cashFlowBudget/extractSignals'
import {
  DIRECTIONAL_PLAN_CLARITY,
  DOCUMENTED_PLAN_CLARITY,
  EMPLOYER_MATCH_STATUS,
  EXPLICIT_NO_PLAN_CLARITY,
  FAMILY_RETIREMENT_NOT_SAVING_BAND,
  FAMILY_RETIREMENT_SAVING_BANDS,
  RETIREMENT_AGE_PLAUSIBLE_MAX,
  RETIREMENT_AGE_PLAUSIBLE_MIN,
  RETIREMENT_SOURCE_CONFLICT_TOLERANCE,
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

function parseNonNegativeAmount(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

export function valuesMateriallyConflict(
  a: number,
  b: number,
  tolerance: number = RETIREMENT_SOURCE_CONFLICT_TOLERANCE,
): boolean {
  const denom = Math.max(Math.abs(a), Math.abs(b), Number.EPSILON)
  return Math.abs(a - b) / denom > tolerance
}

function nestedString(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): string | null {
  return asString(asRecord(answers?.[section])?.[field])
}

function nestedAmount(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): number | null {
  return parseNonNegativeAmount(asRecord(answers?.[section])?.[field])
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
      for (const section of ['financial', 'savings', 'lifestyle', 'household', 'retirement']) {
        const nested = parseNonNegativeAmount(asRecord(source[section])?.[key])
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
      for (const section of ['financial', 'savings', 'lifestyle', 'household', 'retirement']) {
        const nested = parseFiniteNumber(asRecord(source[section])?.[key])
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
      for (const section of [
        'financial',
        'savings',
        'lifestyle',
        'household',
        'vision',
        'retirement',
      ]) {
        const nested = asString(asRecord(source[section])?.[key])
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
      for (const section of ['financial', 'savings', 'lifestyle', 'retirement']) {
        const nested = parseRate(asRecord(source[section])?.[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

/**
 * Funding / readiness ratios may exceed 100% (e.g. 1.1 or 110%).
 * Documented rule:
 * - strings with `%` → percent/100 (110% → 1.1)
 * - 0 ≤ n ≤ 10 as decimal ratio (1.1 = 110%)
 * - integer 11–1000 → whole percent / 100 (110 → 1.1)
 * - non-integer in (10, 1000] without `%` → null (ambiguous)
 * - negative / non-finite / > 10 after normalization → null
 */
export function parseFundingRatio(value: unknown): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const hasPercent = trimmed.includes('%')
    const parsed = Number.parseFloat(trimmed.replace(/%/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return null
    if (hasPercent) {
      const ratio = parsed / 100
      return ratio <= 10 ? ratio : null
    }
    return parseFundingRatio(parsed)
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  if (value <= 10) return value
  if (value > 1000) return null
  if (Number.isInteger(value)) {
    const ratio = value / 100
    return ratio <= 10 ? ratio : null
  }
  return null
}

function firstFundingRatio(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): number | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseFundingRatio(source[key])
      if (direct != null) return direct
      for (const section of ['financial', 'savings', 'lifestyle', 'retirement']) {
        const nested = parseFundingRatio(asRecord(source[section])?.[key])
        if (nested != null) return nested
      }
    }
  }
  return null
}

function fieldPresent(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): boolean {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      if (source[key] != null && source[key] !== '') return true
      for (const section of ['financial', 'savings', 'lifestyle', 'retirement']) {
        const nested = asRecord(source[section])?.[key]
        if (nested != null && nested !== '') return true
      }
    }
  }
  return false
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim()
}

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

function isInList(value: string | null, list: readonly string[]): boolean {
  if (value == null) return false
  const normalized = normalizeToken(value).replace(/\s+/g, '-')
  return list.some((item) => normalizeToken(item).replace(/\s+/g, '-') === normalized)
}

export type ContributionActivitySource =
  | 'direct_rate'
  | 'calculated_rate'
  | 'activity_confirmed'
  | 'explicit_not_saving'
  | null

export type MatchApplicability =
  | 'applicable'
  | 'not_applicable'
  | 'unknown'

export type MatchCaptureLevel = 'full' | 'partial' | 'unused' | null

export type ProgressRatioSource =
  | 'direct_funding_ratio'
  | 'assets_over_target'
  | 'income_over_goal'
  | null

export type MemberMatchSignal = {
  memberId: string | null
  applicability: MatchApplicability
  capture: MatchCaptureLevel
  employeeContributionRate: number | null
  matchThresholdRate: number | null
  conflict: boolean
}

export type RetirementReadinessSignals = {
  /** Verified contribution rate when available (0.15 = 15%). */
  contributionRate: number | null
  contributionRateSource: ContributionActivitySource
  contributionRateConflict: boolean
  contributionAmountConflict: boolean
  monthlyRetirementContribution: number | null
  monthlyEarnedIncome: number | null
  incomeSourceConflict: boolean
  contributionActivityConfirmed: boolean
  explicitNotSaving: boolean
  contributionDataInvalid: boolean
  /** Whether rate uses total-household vs employee-only semantics. */
  contributionRateScope: 'household_total' | 'employee' | null

  matchApplicability: MatchApplicability
  matchCapture: MatchCaptureLevel
  matchConflict: boolean
  memberMatches: MemberMatchSignal[]
  /** Aggregation note for evidence. */
  matchAggregation: 'household' | 'members' | 'none'

  progressRatio: number | null
  progressRatioSource: ProgressRatioSource
  progressDerivedConflict: boolean
  progressAssetConflict: boolean
  currentRetirementAssets: number | null
  retirementAssetTarget: number | null
  projectedRetirementIncome: number | null
  retirementIncomeGoal: number | null
  rawProgressRatio: number | null
  derivedProgressRatio: number | null
  hasRetirementAssetsWithoutTarget: boolean
  progressDataInvalid: boolean

  hasTargetRetirementAge: boolean
  hasRetirementIncomeGoal: boolean
  hasRetirementStrategy: boolean
  /**
   * Assessment planClarity is somewhat-clear (directional only).
   * Does not earn the strategy point without an explicit plan flag.
   */
  somewhatClearPlanClarity: boolean
  explicitNoPlanningElements: boolean
  planElementsUnknown: boolean
  targetRetirementAge: number | null
  retirementAgeInvalid: boolean
  incomeGoalInvalid: boolean
}

function parsePlausibleRetirementAge(value: unknown, currentAge: number | null): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null) return null
  if (!Number.isInteger(parsed) && !Number.isInteger(Number(value))) {
    // Allow "65" string; reject clearly non-age floats like 65.7 only if not whole.
    if (Math.abs(parsed - Math.round(parsed)) > 1e-9) return null
  }
  const age = Math.round(parsed)
  if (age < RETIREMENT_AGE_PLAUSIBLE_MIN || age > RETIREMENT_AGE_PLAUSIBLE_MAX) return null
  if (currentAge != null && age < currentAge) return null
  return age
}

function resolveMemberMatches(
  sources: Array<Record<string, unknown> | null | undefined>,
): MemberMatchSignal[] {
  for (const source of sources) {
    if (!source) continue
    const raw =
      source.memberRetirementMatches ??
      source.member_retirement_matches ??
      source.householdMemberRetirement
    if (!Array.isArray(raw)) continue
    const members: MemberMatchSignal[] = []
    for (const item of raw) {
      const record = asRecord(item)
      if (!record) continue
      const status = asString(record.employerMatch ?? record.matchStatus ?? record.status)
      const employeeRate = parseRate(
        record.employeeContributionRate ?? record.contributionRate ?? record.employeeRate,
      )
      const threshold = parseRate(
        record.matchThresholdRate ?? record.fullMatchRate ?? record.matchThreshold,
      )
      let applicability: MatchApplicability = 'unknown'
      let capture: MatchCaptureLevel = null
      let conflict = false

      if (isInList(status, EMPLOYER_MATCH_STATUS.notApplicable)) {
        applicability = 'not_applicable'
      } else if (isInList(status, EMPLOYER_MATCH_STATUS.full)) {
        applicability = 'applicable'
        capture = 'full'
      } else if (isInList(status, EMPLOYER_MATCH_STATUS.partial)) {
        applicability = 'applicable'
        capture = 'partial'
      } else if (isInList(status, EMPLOYER_MATCH_STATUS.unused)) {
        applicability = 'applicable'
        capture = 'unused'
      } else if (isInList(status, EMPLOYER_MATCH_STATUS.unknown)) {
        applicability = 'unknown'
      } else if (threshold != null) {
        applicability = 'applicable'
        if (employeeRate == null) {
          applicability = 'unknown'
        } else if (employeeRate + 1e-12 >= threshold) {
          capture = 'full'
        } else if (employeeRate > 0) {
          capture = 'partial'
        } else {
          capture = 'unused'
        }
      }

      if (employeeRate != null && threshold != null && status) {
        const implied =
          employeeRate + 1e-12 >= threshold
            ? 'full'
            : employeeRate > 0
              ? 'partial'
              : 'unused'
        if (
          (isInList(status, EMPLOYER_MATCH_STATUS.full) && implied !== 'full') ||
          (isInList(status, EMPLOYER_MATCH_STATUS.unused) && implied !== 'unused')
        ) {
          conflict = true
        }
      }

      members.push({
        memberId: asString(record.memberId ?? record.id),
        applicability,
        capture,
        employeeContributionRate: employeeRate,
        matchThresholdRate: threshold,
        conflict,
      })
    }
    if (members.length > 0) return members
  }
  return []
}

/**
 * Extracts Retirement Readiness signals. Normalizes values; does not score.
 */
export function extractRetirementReadinessSignals(
  input: HouseholdFinancialProgressInput,
): RetirementReadinessSignals {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const sources = [
    input.assessments?.retirement?.derived_metrics,
    input.assessments?.family?.derived_metrics,
    retirementAnswers,
    familyAnswers,
  ]

  // --- Income (earned) ---
  const monthlyIncomeDirect = firstAmount(sources, [
    'monthlyEarnedIncome',
    'monthlyHouseholdIncome',
    'monthlyIncome',
    'monthly_income',
  ])
  const annualIncomeDirect = firstAmount(sources, [
    'currentAnnualGrossIncome',
    'annualEarnedIncome',
    'annualHouseholdIncome',
    'annualIncome',
    'householdIncome',
  ])
  // Retirement assessment lifestyle income is annual.
  const lifestyleAnnual = nestedAmount(retirementAnswers, 'lifestyle', 'currentAnnualGrossIncome')
  const familyAnnual = nestedAmount(familyAnswers, 'financial', 'householdIncome')
  const incomeReconciled = reconcileMonthlyAnnual(
    monthlyIncomeDirect,
    annualIncomeDirect ?? lifestyleAnnual ?? familyAnnual,
  )

  // --- Contributions ---
  const monthlyContributionDirect = firstAmount(sources, [
    'monthlyRetirementContribution',
    'monthly_retirement_contribution',
    'retirementMonthlyContribution',
    'employeeMonthlyRetirementContribution',
  ])
  const annualContributionDirect = firstAmount(sources, [
    'annualRetirementContribution',
    'annual_retirement_contribution',
    'employeeAnnualRetirementContribution',
  ])
  // Nested savings.monthlyContribution from retirement assessment.
  const savingsMonthly = nestedAmount(retirementAnswers, 'savings', 'monthlyContribution')
  const contributionReconciled = reconcileMonthlyAnnual(
    monthlyContributionDirect ?? savingsMonthly,
    annualContributionDirect,
  )

  const signedContribution = firstSignedAmount(sources, [
    'monthlyRetirementContribution',
    'monthlyContribution',
    'annualRetirementContribution',
  ])
  const contributionDataInvalid = signedContribution != null && signedContribution < 0

  const derivedContributionRate = firstRate(sources, [
    'retirementContributionRate',
    'retirement_contribution_rate',
    'employeeRetirementContributionRate',
    'householdRetirementContributionRate',
  ])
  const derivedRatePresent = fieldPresent(sources, [
    'retirementContributionRate',
    'retirement_contribution_rate',
    'employeeRetirementContributionRate',
    'householdRetirementContributionRate',
  ])
  const derivedRateUnusable = derivedRatePresent && derivedContributionRate == null

  const householdTotalRate = firstRate(sources, [
    'householdRetirementContributionRate',
    'totalHouseholdRetirementContributionRate',
  ])

  let rawContributionRate: number | null = null
  let rawRateImplausible = false
  const zeroOrNegativeIncome =
    incomeReconciled.value != null && incomeReconciled.value <= 0
  if (
    contributionReconciled.value != null &&
    incomeReconciled.value != null &&
    incomeReconciled.value > 0 &&
    !contributionReconciled.conflict &&
    !incomeReconciled.conflict &&
    !contributionDataInvalid
  ) {
    const calculated = contributionReconciled.value / incomeReconciled.value
    if (calculated > 1) rawRateImplausible = true
    else if (calculated >= 0) rawContributionRate = calculated
  }

  let contributionRate: number | null = null
  let contributionRateSource: ContributionActivitySource = null
  let contributionRateConflict = false
  let contributionRateScope: RetirementReadinessSignals['contributionRateScope'] = null

  const canUseRawRate = rawContributionRate != null && !rawRateImplausible

  if (derivedContributionRate != null && canUseRawRate) {
    if (valuesMateriallyConflict(derivedContributionRate, rawContributionRate!)) {
      contributionRateConflict = true
    } else {
      contributionRate = derivedContributionRate
      contributionRateSource = 'direct_rate'
      contributionRateScope = householdTotalRate != null ? 'household_total' : 'employee'
    }
  } else if (derivedContributionRate != null && !canUseRawRate) {
    contributionRate = derivedContributionRate
    contributionRateSource = 'direct_rate'
    contributionRateScope = householdTotalRate != null ? 'household_total' : 'employee'
  } else if (canUseRawRate) {
    contributionRate = rawContributionRate
    contributionRateSource = 'calculated_rate'
    contributionRateScope = 'employee'
  }

  const familyBand =
    nestedString(familyAnswers, 'financial', 'retirementContribution') ??
    firstString(sources, ['retirementContribution', 'retirement_contribution'])
  const consistency = nestedString(retirementAnswers, 'savings', 'contributionConsistency')
  const employerMatchStatus = nestedString(retirementAnswers, 'savings', 'employerMatch')

  let contributionActivityConfirmed = false
  let explicitNotSaving = false

  if (contributionRate == null && !contributionRateConflict && !contributionDataInvalid) {
    if (
      familyBand === FAMILY_RETIREMENT_NOT_SAVING_BAND ||
      consistency === 'not-saving' ||
      normalizeToken(consistency ?? '') === 'not saving'
    ) {
      explicitNotSaving = true
      contributionRateSource = 'explicit_not_saving'
    } else if (
      (familyBand != null &&
        (FAMILY_RETIREMENT_SAVING_BANDS as readonly string[]).includes(familyBand)) ||
      (consistency != null &&
        ['always', 'most-months', 'most_months', 'sometimes', 'rarely'].includes(consistency)) ||
      (contributionReconciled.value != null &&
        contributionReconciled.value > 0 &&
        !contributionReconciled.conflict &&
        incomeReconciled.value == null)
    ) {
      contributionActivityConfirmed = true
      contributionRateSource = 'activity_confirmed'
    }
  }

  if (contributionRate != null && contributionRate === 0) {
    explicitNotSaving = true
    contributionRateSource = 'explicit_not_saving'
  }

  // --- Employer match ---
  const memberMatches = resolveMemberMatches(sources)
  let matchApplicability: MatchApplicability = 'unknown'
  let matchCapture: MatchCaptureLevel = null
  let matchConflict = false
  let matchAggregation: RetirementReadinessSignals['matchAggregation'] = 'none'

  if (memberMatches.length > 0) {
    matchAggregation = 'members'
    const applicable = memberMatches.filter((m) => m.applicability === 'applicable')
    const unknown = memberMatches.filter((m) => m.applicability === 'unknown')
    if (memberMatches.some((m) => m.conflict)) matchConflict = true
    if (applicable.length === 0 && unknown.length === 0) {
      matchApplicability = 'not_applicable'
    } else if (unknown.length > 0 && applicable.length === 0) {
      matchApplicability = 'unknown'
    } else if (matchConflict) {
      matchApplicability = 'applicable'
      matchCapture = null
    } else if (applicable.some((m) => m.capture === 'unused')) {
      matchApplicability = 'applicable'
      matchCapture = 'unused'
    } else if (applicable.some((m) => m.capture === 'partial')) {
      matchApplicability = 'applicable'
      matchCapture = 'partial'
    } else if (applicable.every((m) => m.capture === 'full') && unknown.length === 0) {
      matchApplicability = 'applicable'
      matchCapture = 'full'
    } else if (applicable.every((m) => m.capture === 'full') && unknown.length > 0) {
      // Unknown members do not invent data; known applicable all full → still need confirm unknowns
      matchApplicability = 'unknown'
      matchCapture = 'full'
    } else {
      matchApplicability = 'unknown'
    }
  } else {
    matchAggregation = 'household'
    const matchThreshold = firstRate(sources, [
      'employerMatchThreshold',
      'employer_match_threshold',
      'fullMatchContributionRate',
      'matchThresholdRate',
    ])
    const employeeRateForMatch =
      contributionRateScope === 'employee' || contributionRateScope == null
        ? contributionRate
        : firstRate(sources, ['employeeRetirementContributionRate', 'employeeContributionRate'])

    if (isInList(employerMatchStatus, EMPLOYER_MATCH_STATUS.notApplicable)) {
      matchApplicability = 'not_applicable'
    } else if (isInList(employerMatchStatus, EMPLOYER_MATCH_STATUS.full)) {
      matchApplicability = 'applicable'
      matchCapture = 'full'
      if (
        matchThreshold != null &&
        employeeRateForMatch != null &&
        employeeRateForMatch + 1e-12 < matchThreshold
      ) {
        matchConflict = true
        matchCapture = null
      }
    } else if (isInList(employerMatchStatus, EMPLOYER_MATCH_STATUS.partial)) {
      matchApplicability = 'applicable'
      matchCapture = 'partial'
    } else if (isInList(employerMatchStatus, EMPLOYER_MATCH_STATUS.unused)) {
      matchApplicability = 'applicable'
      matchCapture = 'unused'
    } else if (isInList(employerMatchStatus, EMPLOYER_MATCH_STATUS.unknown)) {
      matchApplicability = 'unknown'
    } else if (matchThreshold != null) {
      matchApplicability = 'applicable'
      if (employeeRateForMatch == null) {
        matchApplicability = 'unknown'
      } else if (employeeRateForMatch + 1e-12 >= matchThreshold) {
        matchCapture = 'full'
      } else if (employeeRateForMatch > 0) {
        matchCapture = 'partial'
      } else {
        matchCapture = 'unused'
      }
    } else {
      // Plan existence without match terms
      const hasPlan = firstString(sources, [
        'hasEmployerRetirementPlan',
        'employerRetirementPlan',
        'has_employer_retirement_plan',
      ])
      if (hasPlan && ['yes', 'true', 'active'].includes(normalizeToken(hasPlan))) {
        matchApplicability = 'unknown'
      }
    }
  }

  // --- Progress ---
  const totalAssets = firstAmount(sources, [
    'totalRetirementAssets',
    'total_retirement_assets',
    'currentRetirementSavings',
    'current_retirement_savings',
    'retirementAssets',
  ])
  const savingsAssets = nestedAmount(retirementAnswers, 'savings', 'currentRetirementSavings')
  const accountSum = firstAmount(sources, [
    'sumOfRetirementAccountBalances',
    'retirementAccountBalanceSum',
  ])
  // Prefer household total; detect conflict with account sum.
  let currentRetirementAssets = totalAssets ?? savingsAssets
  let progressAssetConflict = false
  if (totalAssets != null && accountSum != null && valuesMateriallyConflict(totalAssets, accountSum)) {
    progressAssetConflict = true
    currentRetirementAssets = null
  } else if (totalAssets == null && accountSum != null) {
    currentRetirementAssets = accountSum
  }

  // Exclude non-retirement balances from being used as retirement assets (never read them as assets).
  const retirementAssetTarget = firstAmount(sources, [
    'retirementAssetTarget',
    'retirement_asset_target',
    'documentedRetirementAssetTarget',
    'targetRetirementAssets',
  ])

  const projectedRetirementIncome = firstAmount(sources, [
    'projectedRetirementIncome',
    'projected_retirement_income',
    'documentedProjectedRetirementIncome',
    'expectedMonthlyRetirementIncome',
  ])
  // Sum documented income-source fields only when present (no invention).
  const incomeSources = asRecord(retirementAnswers?.incomeSources)
  let incomeSourcesSum: number | null = null
  if (incomeSources) {
    const parts = [
      parseNonNegativeAmount(incomeSources.socialSecurityMonthly),
      parseNonNegativeAmount(incomeSources.pensionMonthly),
      parseNonNegativeAmount(incomeSources.annuityMonthly),
      parseNonNegativeAmount(incomeSources.otherMonthlyIncome),
      parseNonNegativeAmount(incomeSources.partTimeMonthlyIncome),
    ].filter((v): v is number => v != null)
    if (parts.length > 0) incomeSourcesSum = parts.reduce((a, b) => a + b, 0)
  }

  const retirementIncomeGoal =
    firstAmount(sources, [
      'retirementIncomeGoal',
      'retirement_income_goal',
      'targetMonthlyRetirementSpending',
      'documentedRetirementIncomeGoal',
    ]) ?? nestedAmount(retirementAnswers, 'lifestyle', 'estimatedMonthlyRetirementSpending')

  const derivedProgressRatio = firstFundingRatio(sources, [
    'retirementFundingRatio',
    'retirement_funding_ratio',
    'fundingRatio',
    'fundedRatio',
    'retirementReadinessRatio',
  ])
  const derivedProgressPresent = fieldPresent(sources, [
    'retirementFundingRatio',
    'retirement_funding_ratio',
    'fundingRatio',
    'fundedRatio',
    'retirementReadinessRatio',
  ])

  let rawProgressRatio: number | null = null
  let progressRatioSource: ProgressRatioSource = null
  let progressDataInvalid = false

  const signedAssets = firstSignedAmount(sources, [
    'totalRetirementAssets',
    'currentRetirementSavings',
  ])
  if (signedAssets != null && signedAssets < 0) progressDataInvalid = true

  if (
    !progressAssetConflict &&
    !progressDataInvalid &&
    currentRetirementAssets != null &&
    retirementAssetTarget != null &&
    retirementAssetTarget > 0
  ) {
    rawProgressRatio = currentRetirementAssets / retirementAssetTarget
    progressRatioSource = 'assets_over_target'
  } else {
    const projected = projectedRetirementIncome ?? incomeSourcesSum
    if (
      projected != null &&
      retirementIncomeGoal != null &&
      retirementIncomeGoal > 0
    ) {
      rawProgressRatio = projected / retirementIncomeGoal
      progressRatioSource = 'income_over_goal'
    }
  }

  if (rawProgressRatio != null && rawProgressRatio > 10) {
    // Extremely implausible ratio without clear semantics → invalid.
    progressDataInvalid = true
    rawProgressRatio = null
  }

  let progressRatio: number | null = null
  let progressDerivedConflict = false
  const canUseRawProgress = rawProgressRatio != null && !progressDataInvalid && !progressAssetConflict

  if (derivedProgressRatio != null && canUseRawProgress) {
    if (valuesMateriallyConflict(derivedProgressRatio, rawProgressRatio!)) {
      progressDerivedConflict = true
      progressRatio = null
      progressRatioSource = null
    } else {
      progressRatio = derivedProgressRatio
      progressRatioSource = 'direct_funding_ratio'
    }
  } else if (derivedProgressRatio != null && !canUseRawProgress) {
    progressRatio = derivedProgressRatio
    progressRatioSource = 'direct_funding_ratio'
  } else if (canUseRawProgress) {
    progressRatio = rawProgressRatio
    // keep assets_over_target / income_over_goal
  } else if (derivedProgressPresent && derivedProgressRatio == null) {
    progressDataInvalid = true
  }

  const hasRetirementAssetsWithoutTarget =
    currentRetirementAssets != null &&
    currentRetirementAssets > 0 &&
    retirementAssetTarget == null &&
    progressRatio == null &&
    !progressDerivedConflict

  // --- Plan & goals ---
  const currentAge =
    parseFiniteNumber(nestedString(retirementAnswers, 'household', 'currentAge')) ??
    nestedAmount(retirementAnswers, 'household', 'currentAge')
  const ageRaw = nestedString(retirementAnswers, 'household', 'targetRetirementAge')
  const ageFromDerived = firstAmount(sources, ['targetRetirementAge', 'target_retirement_age'])
  const parsedAge = parsePlausibleRetirementAge(ageRaw ?? ageFromDerived, currentAge)
  const agePresent = ageRaw != null || ageFromDerived != null
  const retirementAgeInvalid = agePresent && parsedAge == null

  const incomeGoalRaw = retirementIncomeGoal
  const incomeGoalInvalid = incomeGoalRaw != null && incomeGoalRaw <= 0

  const planClarity = nestedString(retirementAnswers, 'vision', 'planClarity')
  const somewhatClearPlanClarity = isInList(planClarity, DIRECTIONAL_PLAN_CLARITY)

  const strategyFlagKeys = [
    'hasRetirementPlan',
    'has_retirement_plan',
    'retirementPlanDocumented',
    'documentedRetirementStrategy',
    'completedRetirementAnalysis',
    'completed_retirement_analysis',
    'writtenAccumulationStrategy',
    'writtenDistributionStrategy',
    'advisorRetirementStrategy',
  ] as const

  const strategyFlag = firstString(sources, strategyFlagKeys)
  const strategyFlagTruthy = sources.some((source) => {
    if (!source) return false
    for (const key of strategyFlagKeys) {
      const value = source[key]
      if (value === true) return true
      const nested = asRecord(source.vision)?.[key] ?? asRecord(source.savings)?.[key]
      if (nested === true) return true
    }
    return false
  })

  const explicitStrategyFlag =
    strategyFlagTruthy ||
    (strategyFlag != null &&
      ['yes', 'true', 'documented', 'complete', 'completed', 'active', 'written'].includes(
        normalizeToken(strategyFlag),
      ))

  // very-clear = "Very clear written plan" in assessment semantics → strategy element.
  // somewhat-clear alone never satisfies strategy without an explicit plan flag.
  const hasRetirementStrategy =
    isInList(planClarity, DOCUMENTED_PLAN_CLARITY) || explicitStrategyFlag

  const explicitNoStrategy =
    isInList(planClarity, EXPLICIT_NO_PLAN_CLARITY) ||
    (strategyFlag != null && ['no', 'false', 'none'].includes(normalizeToken(strategyFlag)))

  const hasTargetRetirementAge = parsedAge != null
  const hasRetirementIncomeGoal = incomeGoalRaw != null && incomeGoalRaw > 0

  const planElementsUnknown =
    !hasTargetRetirementAge &&
    !retirementAgeInvalid &&
    !hasRetirementIncomeGoal &&
    !incomeGoalInvalid &&
    !hasRetirementStrategy &&
    !somewhatClearPlanClarity &&
    !explicitNoStrategy &&
    planClarity == null &&
    strategyFlag == null &&
    !strategyFlagTruthy &&
    ageRaw == null &&
    ageFromDerived == null &&
    incomeGoalRaw == null

  const explicitNoPlanningElements =
    explicitNoStrategy &&
    !hasTargetRetirementAge &&
    !hasRetirementIncomeGoal &&
    !retirementAgeInvalid &&
    !incomeGoalInvalid

  return {
    contributionRate,
    contributionRateSource,
    contributionRateConflict,
    contributionAmountConflict: contributionReconciled.conflict,
    monthlyRetirementContribution: contributionReconciled.value,
    monthlyEarnedIncome: incomeReconciled.value,
    incomeSourceConflict: incomeReconciled.conflict,
    contributionActivityConfirmed,
    explicitNotSaving,
    contributionDataInvalid:
      contributionDataInvalid ||
      rawRateImplausible ||
      zeroOrNegativeIncome ||
      (derivedRateUnusable && contributionRate == null && !canUseRawRate),
    contributionRateScope,
    matchApplicability,
    matchCapture,
    matchConflict,
    memberMatches,
    matchAggregation,
    progressRatio,
    progressRatioSource,
    progressDerivedConflict,
    progressAssetConflict,
    currentRetirementAssets,
    retirementAssetTarget,
    projectedRetirementIncome: projectedRetirementIncome ?? incomeSourcesSum,
    retirementIncomeGoal,
    rawProgressRatio,
    derivedProgressRatio,
    hasRetirementAssetsWithoutTarget,
    progressDataInvalid,
    hasTargetRetirementAge,
    hasRetirementIncomeGoal,
    hasRetirementStrategy,
    somewhatClearPlanClarity,
    explicitNoPlanningElements,
    planElementsUnknown,
    targetRetirementAge: parsedAge,
    retirementAgeInvalid,
    incomeGoalInvalid,
  }
}
