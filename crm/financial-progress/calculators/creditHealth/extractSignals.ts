import type { HouseholdFinancialProgressInput } from '../../types'
import {
  CREDIT_REVIEW_CURRENT_MONTHS,
  CREDIT_REVIEW_DATE_ALIASES,
  CREDIT_UTILIZATION_CONFLICT_TOLERANCE,
  PAYMENT_HISTORY_DATE_ALIASES,
  PAYMENT_HISTORY_RECENT_MONTHS,
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
  const cleaned = value.replace(/[$,\s,%]/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNonNegative(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed == null || parsed < 0) return null
  return parsed
}

/**
 * Parses a utilization ratio from decimal (0.2) or percent (20 / "20%").
 * Values > 1 and ≤ 100 are treated as percent; > 100 rejected.
 */
export function parseUtilizationRatio(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) return null
    if (value > 1 && value <= 100) return value / 100
    if (value > 100) return null
    return value
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const hasPercent = trimmed.includes('%')
  const cleaned = trimmed.replace(/%/g, '').replace(/,/g, '').trim()
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  if (hasPercent || (parsed > 1 && parsed <= 100)) return parsed / 100
  if (parsed > 100) return null
  return parsed
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase().replace(/[_-]/g, ' ')
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'current' ||
    normalized === 'on time' ||
    normalized === 'current on payments' ||
    normalized === 'enabled' ||
    normalized === 'active' ||
    normalized === 'documented' ||
    normalized === 'completed' ||
    normalized === 'ongoing'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'none' ||
    normalized === 'not current' ||
    normalized === 'delinquent' ||
    normalized === 'disabled' ||
    normalized === 'inactive' ||
    normalized === 'not documented' ||
    normalized === 'outdated'
  ) {
    return 'no'
  }
  return null
}

const CREDIT_NESTED_SECTIONS = [
  'credit',
  'creditHealth',
  'credit_health',
  'financial',
  'debt',
  'bureau',
  'creditBureau',
  'importedCredit',
] as const

function collectFromSource(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  parse: (value: unknown) => number | null,
): number[] {
  if (!source) return []
  const found: number[] = []
  for (const key of keys) {
    const direct = parse(source[key])
    if (direct != null) found.push(direct)
    for (const section of CREDIT_NESTED_SECTIONS) {
      const nested = asRecord(source[section])
      if (!nested) continue
      const value = parse(nested[key])
      if (value != null) found.push(value)
    }
  }
  return found
}

function collectStringsFromSource(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string[] {
  if (!source) return []
  const found: string[] = []
  for (const key of keys) {
    const direct = asString(source[key])
    if (direct) found.push(direct)
    for (const section of CREDIT_NESTED_SECTIONS) {
      const nested = asRecord(source[section])
      if (!nested) continue
      const value = asString(nested[key])
      if (value) found.push(value)
    }
  }
  return found
}

/**
 * Source precedence (first list entry wins for non-conflict single-value reads):
 * 1. Structured credit assessment answers
 * 2. Derived metrics
 * 3. Imported bureau summaries
 * 4. Household financial / debt profile fields
 *
 * Never consults income, net worth, retirement assets, or home ownership.
 */
function buildPrecedenceSources(
  input: HouseholdFinancialProgressInput,
): Array<Record<string, unknown> | null | undefined> {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const protectionAnswers = input.assessments?.protection?.answers ?? null
  const businessAnswers = input.assessments?.business?.answers ?? null

  const creditSections = [
    asRecord(familyAnswers?.credit),
    asRecord(familyAnswers?.creditHealth),
    asRecord(familyAnswers?.credit_health),
    asRecord(retirementAnswers?.credit),
    asRecord(protectionAnswers?.credit),
    asRecord(businessAnswers?.credit),
  ]

  const derived = [
    input.assessments?.family?.derived_metrics,
    input.assessments?.retirement?.derived_metrics,
    input.assessments?.protection?.derived_metrics,
    input.assessments?.business?.derived_metrics,
  ]

  const bureauSummaries = derived.flatMap((metrics) => {
    if (!metrics) return []
    return [
      asRecord(metrics.bureauSummary),
      asRecord(metrics.importedCreditSummary),
      asRecord(metrics.creditBureauSummary),
      asRecord(metrics.creditReportSummary),
    ]
  })

  const profileSources = [familyAnswers, retirementAnswers, protectionAnswers]

  return [...creditSections, ...derived, ...bureauSummaries, ...profileSources]
}

function firstNumber(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
  parse: (value: unknown) => number | null = parseNonNegative,
): number | null {
  for (const source of sources) {
    const values = collectFromSource(source, keys, parse)
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
    values.push(...collectFromSource(source, keys, parse))
  }
  return values
}

function firstString(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): string | null {
  for (const source of sources) {
    const values = collectStringsFromSource(source, keys)
    if (values.length > 0) return values[0]!
  }
  return null
}

function allYesNo(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): Array<'yes' | 'no'> {
  const votes: Array<'yes' | 'no'> = []
  for (const source of sources) {
    for (const raw of collectStringsFromSource(source, keys)) {
      const vote = yesNoFromString(raw)
      if (vote) votes.push(vote)
    }
    if (!source) continue
    for (const key of keys) {
      if (typeof source[key] === 'boolean') votes.push(source[key] ? 'yes' : 'no')
      for (const section of CREDIT_NESTED_SECTIONS) {
        const nested = asRecord(source[section])
        if (!nested) continue
        if (typeof nested[key] === 'boolean') votes.push(nested[key] ? 'yes' : 'no')
      }
    }
  }
  return votes
}

function resolveYesNoConflict(
  votes: Array<'yes' | 'no'>,
): 'yes' | 'no' | 'conflict' | 'unknown' {
  if (votes.length === 0) return 'unknown'
  const hasYes = votes.includes('yes')
  const hasNo = votes.includes('no')
  if (hasYes && hasNo) return 'conflict'
  if (hasYes) return 'yes'
  return 'no'
}

function valuesConflict(values: number[], tolerance: number): boolean {
  if (values.length < 2) return false
  const min = Math.min(...values)
  const max = Math.max(...values)
  return max - min > tolerance
}

/** Whole months between earlier and later ISO dates; null if invalid or inverted. */
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

export type RecencyClass = 'active' | 'recent' | 'historical' | 'unknown' | 'invalid'

export type DerogatoryKind = 'late' | 'collection' | 'charge_off' | 'severe'

export type DerogatoryEventSignal = {
  kind: DerogatoryKind
  recency: RecencyClass
  monthsAgo: number | null
  dateIso: string | null
  count: number | null
}

export type MonitoringLevel =
  | 'active'
  | 'outdated'
  | 'none'
  | 'conflict'
  | 'unknown'

export type PaymentHistoryAssessment = {
  points: number | null
  status: 'met' | 'partial' | 'unmet' | 'incomplete'
  /** Structured notes for evidence wording. */
  notes: string[]
  recentPeriodMonths: number
  hasCurrentCleanBehavior: boolean
  hasActiveOrRecentDerogatory: boolean
  hasHistoricalDerogatory: boolean
  hasUnknownRecencyDerogatory: boolean
  hasInvalidDates: boolean
  hasSamePeriodConflict: boolean
}

export type CreditHealthSignals = {
  paymentAssessment: PaymentHistoryAssessment

  utilizationRatio: number | null
  utilizationConflict: boolean
  hasBalancesWithoutLimits: boolean

  oldestAccountAgeMonths: number | null
  averageAccountAgeMonths: number | null
  recentInquiries12m: number | null
  newAccounts12m: number | null

  monitoring: MonitoringLevel
  monitoringNotes: string[]
  asOfProvided: boolean
  referenceDateIso: string
}

function parseIsoDate(value: string | null): { iso: string | null; invalid: boolean } {
  if (value == null) return { iso: null, invalid: false }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { iso: null, invalid: true }
  return { iso: date.toISOString(), invalid: false }
}

function classifyDateRecency(
  dateRaw: string | null,
  asOfIso: string,
  asOfProvided: boolean,
): { recency: RecencyClass; monthsAgo: number | null; dateIso: string | null } {
  if (dateRaw == null) {
    return { recency: 'unknown', monthsAgo: null, dateIso: null }
  }
  const parsed = parseIsoDate(dateRaw)
  if (parsed.invalid || parsed.iso == null) {
    return { recency: 'invalid', monthsAgo: null, dateIso: null }
  }
  if (!asOfProvided) {
    // Recency requires injectable asOf; do not use a live clock.
    return { recency: 'unknown', monthsAgo: null, dateIso: parsed.iso }
  }
  const monthsAgo = monthsBetween(parsed.iso, asOfIso)
  if (monthsAgo == null) {
    return { recency: 'invalid', monthsAgo: null, dateIso: parsed.iso }
  }
  if (monthsAgo <= PAYMENT_HISTORY_RECENT_MONTHS) {
    return { recency: 'recent', monthsAgo, dateIso: parsed.iso }
  }
  return { recency: 'historical', monthsAgo, dateIso: parsed.iso }
}

function statusImpliesActive(status: string | null): boolean {
  if (!status) return false
  const normalized = status.toLowerCase().replace(/[_-]/g, ' ')
  return (
    normalized === 'active' ||
    normalized === 'open' ||
    normalized === 'current' ||
    normalized === 'unresolved' ||
    normalized.includes('in collection') ||
    normalized.includes('active collection')
  )
}

function statusImpliesHistoricalResolved(status: string | null): boolean {
  if (!status) return false
  const normalized = status.toLowerCase().replace(/[_-]/g, ' ')
  return (
    normalized === 'resolved' ||
    normalized === 'closed' ||
    normalized === 'paid' ||
    normalized === 'historical' ||
    normalized.includes('resolved')
  )
}

function buildDerogatoryEvents(args: {
  sources: Array<Record<string, unknown> | null | undefined>
  asOfIso: string
  asOfProvided: boolean
}): DerogatoryEventSignal[] {
  const { sources, asOfIso, asOfProvided } = args
  const events: DerogatoryEventSignal[] = []

  const lateDate = firstString(sources, [
    ...PAYMENT_HISTORY_DATE_ALIASES.lastLatePaymentDate,
    ...PAYMENT_HISTORY_DATE_ALIASES.mostRecentDelinquencyDate,
  ])
  const recentLateCount = firstNumber(sources, [
    'recentLatePayments',
    'recent_late_payments',
  ])
  const latePaymentCount = firstNumber(sources, [
    'latePaymentCount',
    'late_payment_count',
    'delinquencyCount',
    'delinquency_count',
  ])

  if (recentLateCount != null && recentLateCount > 0) {
    // Field semantics establish recency for recentLatePayments*.
    events.push({
      kind: 'late',
      recency: 'recent',
      monthsAgo: null,
      dateIso: null,
      count: recentLateCount,
    })
  } else if (latePaymentCount != null && latePaymentCount > 0) {
    const dated = classifyDateRecency(lateDate, asOfIso, asOfProvided)
    events.push({
      kind: 'late',
      recency: dated.recency,
      monthsAgo: dated.monthsAgo,
      dateIso: dated.dateIso,
      count: latePaymentCount,
    })
  } else if (lateDate != null) {
    const dated = classifyDateRecency(lateDate, asOfIso, asOfProvided)
    events.push({
      kind: 'late',
      recency: dated.recency,
      monthsAgo: dated.monthsAgo,
      dateIso: dated.dateIso,
      count: 1,
    })
  }

  const collectionsCount = firstNumber(sources, [
    'collectionsCount',
    'collections_count',
    'collectionAccounts',
    'accountsInCollections',
  ])
  const hasActiveCollection = resolveYesNoConflict(
    allYesNo(sources, ['hasActiveCollection', 'has_active_collection', 'activeCollection']),
  )
  const collectionStatus = firstString(sources, [
    'collectionStatus',
    'collection_status',
  ])
  const collectionDate = firstString(sources, [
    ...PAYMENT_HISTORY_DATE_ALIASES.collectionReportedDate,
    ...PAYMENT_HISTORY_DATE_ALIASES.collectionUpdatedDate,
  ])

  if (hasActiveCollection === 'yes' || statusImpliesActive(collectionStatus)) {
    events.push({
      kind: 'collection',
      recency: 'active',
      monthsAgo: 0,
      dateIso: null,
      count: collectionsCount ?? 1,
    })
  } else if (collectionsCount != null && collectionsCount > 0) {
    if (statusImpliesHistoricalResolved(collectionStatus) && collectionDate == null) {
      events.push({
        kind: 'collection',
        recency: 'historical',
        monthsAgo: null,
        dateIso: null,
        count: collectionsCount,
      })
    } else {
      const dated = classifyDateRecency(collectionDate, asOfIso, asOfProvided)
      events.push({
        kind: 'collection',
        recency: dated.recency,
        monthsAgo: dated.monthsAgo,
        dateIso: dated.dateIso,
        count: collectionsCount,
      })
    }
  } else if (collectionDate != null) {
    const dated = classifyDateRecency(collectionDate, asOfIso, asOfProvided)
    events.push({
      kind: 'collection',
      recency: dated.recency,
      monthsAgo: dated.monthsAgo,
      dateIso: dated.dateIso,
      count: 1,
    })
  }

  const chargeOffCount = firstNumber(sources, [
    'chargeOffCount',
    'charge_off_count',
    'chargeOffs',
    'charge_offs',
  ])
  const hasActiveChargeOff = resolveYesNoConflict(
    allYesNo(sources, ['hasActiveChargeOff', 'has_active_charge_off', 'activeChargeOff']),
  )
  const chargeOffStatus = firstString(sources, ['chargeOffStatus', 'charge_off_status'])
  const chargeOffDate = firstString(sources, [...PAYMENT_HISTORY_DATE_ALIASES.chargeOffDate])

  if (hasActiveChargeOff === 'yes' || statusImpliesActive(chargeOffStatus)) {
    events.push({
      kind: 'charge_off',
      recency: 'active',
      monthsAgo: 0,
      dateIso: null,
      count: chargeOffCount ?? 1,
    })
  } else if (chargeOffCount != null && chargeOffCount > 0) {
    if (statusImpliesHistoricalResolved(chargeOffStatus) && chargeOffDate == null) {
      events.push({
        kind: 'charge_off',
        recency: 'historical',
        monthsAgo: null,
        dateIso: null,
        count: chargeOffCount,
      })
    } else {
      const dated = classifyDateRecency(chargeOffDate, asOfIso, asOfProvided)
      events.push({
        kind: 'charge_off',
        recency: dated.recency,
        monthsAgo: dated.monthsAgo,
        dateIso: dated.dateIso,
        count: chargeOffCount,
      })
    }
  } else if (chargeOffDate != null) {
    const dated = classifyDateRecency(chargeOffDate, asOfIso, asOfProvided)
    events.push({
      kind: 'charge_off',
      recency: dated.recency,
      monthsAgo: dated.monthsAgo,
      dateIso: dated.dateIso,
      count: 1,
    })
  }

  const hasSevereDerogatory = resolveYesNoConflict(
    allYesNo(sources, [
      'hasSevereDerogatory',
      'severeDerogatory',
      'hasBankruptcy',
    ]),
  )
  const severeStatus = firstString(sources, [
    'severeDerogatoryStatus',
    'severe_derogatory_status',
    'paymentHistoryStatus',
    'payment_history_status',
  ])
  const derogatoryDate = firstString(sources, [
    ...PAYMENT_HISTORY_DATE_ALIASES.derogatoryEventDate,
  ])
  const statusSevere =
    severeStatus != null &&
    (() => {
      const normalized = severeStatus.toLowerCase().replace(/[_-]/g, ' ')
      return (
        normalized.includes('charge off') ||
        normalized.includes('chargeoff') ||
        normalized.includes('bankruptcy') ||
        normalized.includes('severe') ||
        normalized.includes('repossession')
      )
    })()

  if (hasSevereDerogatory === 'yes' || statusSevere) {
    if (statusImpliesActive(severeStatus)) {
      events.push({
        kind: 'severe',
        recency: 'active',
        monthsAgo: 0,
        dateIso: null,
        count: 1,
      })
    } else if (statusImpliesHistoricalResolved(severeStatus) && derogatoryDate == null) {
      events.push({
        kind: 'severe',
        recency: 'historical',
        monthsAgo: null,
        dateIso: null,
        count: 1,
      })
    } else {
      const dated = classifyDateRecency(derogatoryDate, asOfIso, asOfProvided)
      events.push({
        kind: 'severe',
        recency: dated.recency === 'unknown' && statusSevere ? 'unknown' : dated.recency,
        monthsAgo: dated.monthsAgo,
        dateIso: dated.dateIso,
        count: 1,
      })
    }
  }

  return events
}

function isActiveOrRecent(recency: RecencyClass): boolean {
  return recency === 'active' || recency === 'recent'
}

function assessPaymentHistory(args: {
  sources: Array<Record<string, unknown> | null | undefined>
  asOfIso: string
  asOfProvided: boolean
}): PaymentHistoryAssessment {
  const notes: string[] = []
  const recentPeriodMonths = PAYMENT_HISTORY_RECENT_MONTHS
  notes.push(
    `Recent payment-history window: ${recentPeriodMonths} months ending at the injectable reference date.`,
  )

  const currentOnPayments = resolveYesNoConflict(
    allYesNo(args.sources, [
      'currentOnPayments',
      'current_on_payments',
      'paymentsCurrent',
      'onTimePayments',
    ]),
  )
  const paymentHistoryStatus = firstString(args.sources, [
    'paymentHistoryStatus',
    'payment_history_status',
    'paymentHistory',
    'payment_history',
  ])
  const statusNormalized =
    paymentHistoryStatus?.toLowerCase().replace(/[_-]/g, ' ') ?? null
  const statusClean =
    statusNormalized === 'current' ||
    statusNormalized === 'excellent' ||
    statusNormalized === 'good' ||
    statusNormalized === 'on time' ||
    statusNormalized === 'perfect' ||
    statusNormalized === 'clean'

  const latePaymentCount = firstNumber(args.sources, [
    'latePaymentCount',
    'late_payment_count',
    'delinquencyCount',
    'delinquency_count',
  ])
  const recentLateCount = firstNumber(args.sources, [
    'recentLatePayments',
    'recent_late_payments',
  ])
  const reportingAsOfRaw = firstString(args.sources, [
    ...PAYMENT_HISTORY_DATE_ALIASES.paymentHistoryReportingAsOf,
  ])
  const reportingParsed = parseIsoDate(reportingAsOfRaw)
  let reportingPeriodCurrent = false
  if (reportingParsed.invalid) {
    notes.push('Payment-history reporting period date is invalid.')
  } else if (reportingParsed.iso != null && args.asOfProvided) {
    const months = monthsBetween(reportingParsed.iso, args.asOfIso)
    if (months != null && months <= PAYMENT_HISTORY_RECENT_MONTHS) {
      reportingPeriodCurrent = true
      notes.push('Authoritative recent payment-history reporting period is available.')
    } else if (months != null) {
      notes.push('Payment-history reporting period is older than the recent window.')
    }
  }

  const events = buildDerogatoryEvents(args)
  const hasInvalidDates = events.some((event) => event.recency === 'invalid')
  const hasUnknownRecencyDerogatory = events.some((event) => event.recency === 'unknown')
  const activeOrRecent = events.filter((event) => isActiveOrRecent(event.recency))
  const historical = events.filter((event) => event.recency === 'historical')

  const hasCurrentCleanBehavior =
    currentOnPayments === 'yes' ||
    statusClean ||
    ((latePaymentCount === 0 || recentLateCount === 0) && reportingPeriodCurrent)

  if (currentOnPayments === 'yes') {
    notes.push(
      'Current-on-payments indicates active-account payment behavior; it is not alone a complete payment-history clearance.',
    )
  }
  if (hasCurrentCleanBehavior) {
    notes.push('Clean current-period payment behavior evidence is present.')
  }
  if (activeOrRecent.length > 0) {
    notes.push(
      `Active/recent derogatory evidence: ${activeOrRecent
        .map((event) => event.kind)
        .join(', ')}.`,
    )
  }
  if (historical.length > 0) {
    notes.push(
      `Historical derogatory evidence (older than ${PAYMENT_HISTORY_RECENT_MONTHS} months or marked resolved): ${historical
        .map((event) => event.kind)
        .join(', ')}.`,
    )
  }
  if (hasUnknownRecencyDerogatory) {
    notes.push(
      'Some derogatory evidence lacks dates; unknown recency is not assumed recent.',
    )
  }

  if (currentOnPayments === 'conflict') {
    return {
      points: null,
      status: 'incomplete',
      notes: [...notes, 'Conflicting current-on-payments statuses prevent scoring.'],
      recentPeriodMonths,
      hasCurrentCleanBehavior: false,
      hasActiveOrRecentDerogatory: activeOrRecent.length > 0,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory,
      hasInvalidDates,
      hasSamePeriodConflict: true,
    }
  }

  if (hasInvalidDates) {
    return {
      points: null,
      status: 'incomplete',
      notes: [...notes, 'Invalid derogatory or reporting dates prevent scoring.'],
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: activeOrRecent.length > 0,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory,
      hasInvalidDates: true,
      hasSamePeriodConflict: false,
    }
  }

  // Same-period conflict: clean status claiming the recent window vs active/recent derogatory.
  const cleanClaimsRecentWindow =
    currentOnPayments === 'yes' ||
    statusClean ||
    (latePaymentCount === 0 && reportingPeriodCurrent) ||
    (recentLateCount === 0 && recentLateCount != null)
  if (cleanClaimsRecentWindow && activeOrRecent.length > 0) {
    return {
      points: null,
      status: 'incomplete',
      notes: [
        ...notes,
        'Material conflict: clean-status evidence and active/recent derogatory evidence describe the same recent period.',
      ],
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: true,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory,
      hasInvalidDates: false,
      hasSamePeriodConflict: true,
    }
  }

  // Unknown-recency derogatory counts require dates before interpreting severity.
  if (hasUnknownRecencyDerogatory) {
    return {
      points: null,
      status: 'incomplete',
      notes: [
        ...notes,
        'Insufficient reporting: derogatory evidence exists without usable recency dates.',
      ],
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory: true,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  const recentChargeOffOrSevere = activeOrRecent.some(
    (event) => event.kind === 'charge_off' || event.kind === 'severe',
  )
  if (recentChargeOffOrSevere) {
    return {
      points: 0,
      status: 'unmet',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: true,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  const recentCollections = activeOrRecent.filter((event) => event.kind === 'collection')
  const recentLates = activeOrRecent.filter((event) => event.kind === 'late')
  const recentLateTotal = recentLates.reduce((sum, event) => sum + (event.count ?? 1), 0)

  if (recentCollections.length > 0 || recentLateTotal >= 4 || currentOnPayments === 'no') {
    return {
      points: 1,
      status: 'partial',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: true,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (recentLateTotal >= 2) {
    return {
      points: 2,
      status: 'partial',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: true,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (recentLateTotal === 1) {
    return {
      points: 3,
      status: 'partial',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior,
      hasActiveOrRecentDerogatory: true,
      hasHistoricalDerogatory: historical.length > 0,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  // No active/recent derogatory events.
  if (historical.length > 0 && hasCurrentCleanBehavior) {
    // Isolated historical evidence with clean current behavior → strong partial (3),
    // or full (4) when a recent reporting period / zero recent lates also supports it.
    if (reportingPeriodCurrent && (latePaymentCount === 0 || recentLateCount === 0)) {
      return {
        points: 4,
        status: 'met',
        notes: [
          ...notes,
          'Historical derogatory evidence is acknowledged but does not reduce the score because recent clean reporting is authoritative.',
        ],
        recentPeriodMonths,
        hasCurrentCleanBehavior: true,
        hasActiveOrRecentDerogatory: false,
        hasHistoricalDerogatory: true,
        hasUnknownRecencyDerogatory: false,
        hasInvalidDates: false,
        hasSamePeriodConflict: false,
      }
    }
    return {
      points: 3,
      status: 'partial',
      notes: [
        ...notes,
        'Clean current behavior with isolated historical derogatory evidence earns strong partial credit.',
      ],
      recentPeriodMonths,
      hasCurrentCleanBehavior: true,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: true,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (historical.length > 0 && !hasCurrentCleanBehavior) {
    return {
      points: null,
      status: 'incomplete',
      notes: [
        ...notes,
        'Historical derogatory evidence is present without authoritative clean recent-period confirmation.',
      ],
      recentPeriodMonths,
      hasCurrentCleanBehavior: false,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: true,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  // Clean paths for full credit.
  if (currentOnPayments === 'yes' && events.length === 0) {
    return {
      points: 4,
      status: 'met',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior: true,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: false,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (statusClean && events.length === 0) {
    return {
      points: 4,
      status: 'met',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior: true,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: false,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (
    (latePaymentCount === 0 || recentLateCount === 0) &&
    reportingPeriodCurrent &&
    events.length === 0
  ) {
    return {
      points: 4,
      status: 'met',
      notes,
      recentPeriodMonths,
      hasCurrentCleanBehavior: true,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: false,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: false,
      hasSamePeriodConflict: false,
    }
  }

  if (latePaymentCount === 0 && !reportingPeriodCurrent) {
    return {
      points: null,
      status: 'incomplete',
      notes: [
        ...notes,
        'Zero late-payment count lacks an authoritative recent reporting period, so full credit is not awarded.',
      ],
      recentPeriodMonths,
      hasCurrentCleanBehavior: false,
      hasActiveOrRecentDerogatory: false,
      hasHistoricalDerogatory: false,
      hasUnknownRecencyDerogatory: false,
      hasInvalidDates: reportingParsed.invalid,
      hasSamePeriodConflict: false,
    }
  }

  return {
    points: null,
    status: 'incomplete',
    notes: [
      ...notes,
      'Insufficient authoritative payment-history evidence for the recent reporting window.',
    ],
    recentPeriodMonths,
    hasCurrentCleanBehavior,
    hasActiveOrRecentDerogatory: false,
    hasHistoricalDerogatory: historical.length > 0,
    hasUnknownRecencyDerogatory: false,
    hasInvalidDates: false,
    hasSamePeriodConflict: false,
  }
}

function assessMonitoring(args: {
  sources: Array<Record<string, unknown> | null | undefined>
  asOfIso: string
  asOfProvided: boolean
}): { monitoring: MonitoringLevel; notes: string[] } {
  const notes: string[] = [
    `Credit-review freshness window: ${CREDIT_REVIEW_CURRENT_MONTHS} months ending at the injectable reference date.`,
  ]

  const monitoringEnabled = resolveYesNoConflict(
    allYesNo(args.sources, [
      'creditMonitoringEnabled',
      'credit_monitoring_enabled',
      'creditMonitoring',
      'hasCreditMonitoring',
      'monitoringSubscription',
    ]),
  )
  const alertsEnabled = resolveYesNoConflict(
    allYesNo(args.sources, [
      'creditAlertsEnabled',
      'credit_alerts_enabled',
      'hasCreditAlerts',
    ]),
  )
  const reviewStatusRaw = firstString(args.sources, [
    'creditReviewStatus',
    'credit_review_status',
    'annualCreditReviewStatus',
  ])
  const reviewStatusNormalized =
    reviewStatusRaw?.toLowerCase().replace(/[_-]/g, ' ') ?? null
  const reviewStatusCurrent =
    reviewStatusNormalized === 'current' ||
    reviewStatusNormalized === 'ongoing' ||
    reviewStatusNormalized === 'active' ||
    reviewStatusNormalized === 'up to date'
  const reviewStatusOutdated =
    reviewStatusNormalized === 'outdated' ||
    reviewStatusNormalized === 'stale' ||
    reviewStatusNormalized === 'expired'

  const annualReviewFlag = resolveYesNoConflict(
    allYesNo(args.sources, [
      'annualCreditReviewDocumented',
      'annual_credit_review_documented',
      'creditReviewDocumented',
      'annualCreditReview',
    ]),
  )
  const advisorReviewFlag = resolveYesNoConflict(
    allYesNo(args.sources, [
      'advisorCreditReview',
      'advisor_credit_review',
      'creditReviewedWithAdvisor',
    ]),
  )
  // Explicit currently-maintained annual process (not a one-time undated flag).
  const annualProcessCurrent = resolveYesNoConflict(
    allYesNo(args.sources, [
      'annualCreditReviewCurrent',
      'annual_credit_review_current',
      'maintainsAnnualCreditReview',
    ]),
  )

  const reviewDateRaw = firstString(args.sources, [...CREDIT_REVIEW_DATE_ALIASES])
  const reviewDateParsed = parseIsoDate(reviewDateRaw)

  if (
    monitoringEnabled === 'conflict' ||
    alertsEnabled === 'conflict' ||
    annualReviewFlag === 'conflict' ||
    advisorReviewFlag === 'conflict' ||
    annualProcessCurrent === 'conflict'
  ) {
    return {
      monitoring: 'conflict',
      notes: [...notes, 'Conflicting active/inactive monitoring or review evidence.'],
    }
  }

  if (reviewDateParsed.invalid) {
    return {
      monitoring: 'unknown',
      notes: [...notes, 'Credit-review date is invalid; freshness cannot be scored.'],
    }
  }

  if (monitoringEnabled === 'yes' || alertsEnabled === 'yes') {
    notes.push('Active credit monitoring and/or alerts are enabled.')
    return { monitoring: 'active', notes }
  }

  if (reviewStatusCurrent || annualProcessCurrent === 'yes') {
    notes.push('Explicit status confirms a current/ongoing credit-review process.')
    return { monitoring: 'active', notes }
  }

  if (reviewDateParsed.iso != null) {
    if (!args.asOfProvided) {
      return {
        monitoring: 'unknown',
        notes: [
          ...notes,
          'A review date is present, but input.asOf is required to evaluate freshness.',
        ],
      }
    }
    const months = monthsBetween(reviewDateParsed.iso, args.asOfIso)
    if (months == null) {
      return {
        monitoring: 'unknown',
        notes: [...notes, 'Credit-review date could not be compared to input.asOf.'],
      }
    }
    if (months <= CREDIT_REVIEW_CURRENT_MONTHS) {
      notes.push(`Dated credit review is within ${CREDIT_REVIEW_CURRENT_MONTHS} months.`)
      return { monitoring: 'active', notes }
    }
    notes.push(
      `Dated credit review is older than ${CREDIT_REVIEW_CURRENT_MONTHS} months (${months} months ago).`,
    )
    return { monitoring: 'outdated', notes }
  }

  if (reviewStatusOutdated) {
    return { monitoring: 'outdated', notes: [...notes, 'Review status is explicitly outdated.'] }
  }

  // Undated one-time flags do not prove current monitoring.
  if (advisorReviewFlag === 'yes' || annualReviewFlag === 'yes') {
    return {
      monitoring: 'unknown',
      notes: [
        ...notes,
        'An undated review flag is present; it does not automatically prove a current review process.',
      ],
    }
  }

  if (monitoringEnabled === 'no') {
    return {
      monitoring: 'none',
      notes: [...notes, 'Available data reports no active monitoring or current review process.'],
    }
  }

  if (
    alertsEnabled === 'no' &&
    annualReviewFlag === 'no' &&
    advisorReviewFlag === 'no' &&
    annualProcessCurrent === 'no'
  ) {
    return {
      monitoring: 'none',
      notes: [...notes, 'Available data reports no active monitoring or current review process.'],
    }
  }

  return {
    monitoring: 'unknown',
    notes: [...notes, 'Credit monitoring / review freshness is unknown.'],
  }
}

/**
 * Extracts Credit Health signals. Does not invent payment history, limits, or scores.
 * Date math uses input.asOf only (never a live clock).
 */
export function extractCreditHealthSignals(
  input: HouseholdFinancialProgressInput,
): CreditHealthSignals {
  const sources = buildPrecedenceSources(input)
  const asOfProvided = input.asOf != null && input.asOf.trim() !== ''
  const referenceDateIso = asOfProvided ? input.asOf! : '1970-01-01T00:00:00.000Z'

  const paymentAssessment = assessPaymentHistory({
    sources,
    asOfIso: referenceDateIso,
    asOfProvided,
  })

  const utilizationValues = allNumbers(
    sources,
    [
      'creditCardUtilization',
      'credit_card_utilization',
      'revolvingUtilization',
      'revolving_utilization',
      'creditUtilization',
      'credit_utilization',
      'utilization',
      'cardUtilization',
    ],
    parseUtilizationRatio,
  )

  const revolvingBalance = firstNumber(sources, [
    'creditCardDebt',
    'credit_card_debt',
    'revolvingDebt',
    'revolvingBalance',
    'revolving_balance',
  ])
  const revolvingLimit = firstNumber(sources, [
    'creditCardLimit',
    'credit_card_limit',
    'revolvingCreditLimit',
    'revolving_credit_limit',
    'totalCreditLimit',
    'total_credit_limit',
  ])

  const hasBalancesWithoutLimits =
    revolvingBalance != null && revolvingBalance > 0 && revolvingLimit == null

  let calculatedUtilization: number | null = null
  if (revolvingBalance != null && revolvingLimit != null && revolvingLimit > 0) {
    calculatedUtilization = revolvingBalance / revolvingLimit
  }

  const combinedUtilization = [...utilizationValues]
  if (calculatedUtilization != null) combinedUtilization.push(calculatedUtilization)

  const utilizationConflict = valuesConflict(
    combinedUtilization,
    CREDIT_UTILIZATION_CONFLICT_TOLERANCE,
  )

  const resolvedUtilization = utilizationConflict
    ? null
    : utilizationValues.length > 0
      ? utilizationValues[0]!
      : calculatedUtilization

  const oldestAccountAgeMonths = firstNumber(sources, [
    'oldestAccountAgeMonths',
    'oldest_account_age_months',
    'oldestAccountAge',
    'oldestTradeAgeMonths',
  ])
  const averageAccountAgeMonths = firstNumber(sources, [
    'averageAccountAgeMonths',
    'average_account_age_months',
    'averageAccountAge',
    'avgAccountAgeMonths',
  ])
  const recentInquiries12m = firstNumber(sources, [
    'recentInquiries12m',
    'recent_inquiries_12m',
    'hardInquiries12Months',
    'creditInquiries12m',
    'inquiryCount12m',
  ])
  const newAccounts12m = firstNumber(sources, [
    'newAccounts12m',
    'new_accounts_12m',
    'newCreditAccounts12Months',
    'recentNewAccounts',
  ])

  const { monitoring, notes: monitoringNotes } = assessMonitoring({
    sources,
    asOfIso: referenceDateIso,
    asOfProvided,
  })

  return {
    paymentAssessment,
    utilizationRatio: resolvedUtilization,
    utilizationConflict,
    hasBalancesWithoutLimits: hasBalancesWithoutLimits && resolvedUtilization == null,
    oldestAccountAgeMonths,
    averageAccountAgeMonths,
    recentInquiries12m,
    newAccounts12m,
    monitoring,
    monitoringNotes,
    asOfProvided,
    referenceDateIso,
  }
}
