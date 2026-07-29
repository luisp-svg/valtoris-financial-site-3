import { createClientId } from './onboardingMoney'
import {
  ADVISOR_NOTES_MAX_LENGTH,
  ESTATE_PLANNING_ITEM_KEYS,
  HOUSEHOLD_ONBOARDING_ANSWERS_VERSION,
  emptyAssetsAnswers,
  emptyCashFlowAnswers,
  emptyDebtsAnswers,
  emptyEstateAnswers,
  emptyEstatePlanningItem,
  emptyGoalsAnswers,
  emptyImmediateConcern,
  emptyIncomeAnswers,
  emptyIncomeSource,
  emptyInsuranceAnswers,
  emptyInsuranceCoverage,
  emptyMembersAnswers,
  emptyOverviewAnswers,
  emptyPriorityItem,
  emptyRetirementAnswers,
  emptyAssetItem,
  emptyDebtItem,
  type EstatePlanningItemKey,
  type HouseholdOnboardingAnswers,
  type HouseholdOnboardingMeta,
  type OnboardingAssetItem,
  type OnboardingAssetsAnswers,
  type OnboardingCashFlowAnswers,
  type OnboardingDebtItem,
  type OnboardingDebtsAnswers,
  type OnboardingEstateAnswers,
  type OnboardingEstatePlanningItem,
  type OnboardingGoalsAnswers,
  type OnboardingImmediateConcern,
  type OnboardingIncomeAnswers,
  type OnboardingIncomeSource,
  type OnboardingInsuranceAnswers,
  type OnboardingInsuranceCoverage,
  type OnboardingMembersAnswers,
  type OnboardingOverviewAnswers,
  type OnboardingPriorityItem,
  type OnboardingRetirementAnswers,
} from './onboardingFormTypes'
import { isValidIsoDateOnly } from './onboardingCrossSection'
import {
  DEFAULT_ONBOARDING_SECTION_ID,
  isOnboardingSectionId,
  type OnboardingSectionId,
} from './onboardingSections'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown, maxLen?: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value
  if (maxLen != null && trimmed.length > maxLen) return trimmed.slice(0, maxLen)
  return trimmed
}

function asMoneyCents(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return Math.round(n)
  }
  return null
}

function asNonNegativeInt(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

function asPercent(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseFloat(value)
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  }
  return null
}

function parseCompletedSections(value: unknown): OnboardingSectionId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<OnboardingSectionId>()
  const result: OnboardingSectionId[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !isOnboardingSectionId(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function parseIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return value
}

function parseNullableIsoTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return value
}

function normalizeOverview(raw: unknown): OnboardingOverviewAnswers {
  const base = emptyOverviewAnswers()
  const r = asRecord(raw)
  if (!r) return base
  return {
    maritalOrHouseholdStatus: asString(r.maritalOrHouseholdStatus) as OnboardingOverviewAnswers['maritalOrHouseholdStatus'],
    dependentsCount: asNonNegativeInt(r.dependentsCount),
    preferredContactMethod: asString(r.preferredContactMethod) as OnboardingOverviewAnswers['preferredContactMethod'],
    advisorNotes: asString(r.advisorNotes, ADVISOR_NOTES_MAX_LENGTH),
    additionalContext: asString(r.additionalContext, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeMembers(raw: unknown): OnboardingMembersAnswers {
  const r = asRecord(raw)
  return {
    advisorMemberNotes: asString(r?.advisorMemberNotes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeIncomeSource(raw: unknown): OnboardingIncomeSource | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyIncomeSource({
    id: asString(r.id) || createClientId(),
    memberId: typeof r.memberId === 'string' && r.memberId ? r.memberId : null,
    employerOrSourceName: asString(r.employerOrSourceName),
    occupation: asString(r.occupation),
    employmentStatus: asString(r.employmentStatus) as OnboardingIncomeSource['employmentStatus'],
    grossAnnualIncomeCents: asMoneyCents(r.grossAnnualIncomeCents),
    netMonthlyIncomeCents: asMoneyCents(r.netMonthlyIncomeCents),
    payFrequency: asString(r.payFrequency) as OnboardingIncomeSource['payFrequency'],
    variableOrCommissionIncomeCents: asMoneyCents(r.variableOrCommissionIncomeCents),
    otherIncomeCents: asMoneyCents(r.otherIncomeCents),
    expectedIncomeChanges: asString(r.expectedIncomeChanges, 500),
    employerBenefitsNotes: asString(r.employerBenefitsNotes, 500),
    notes: asString(r.notes, 500),
  })
}

function normalizeIncome(raw: unknown): OnboardingIncomeAnswers {
  const base = emptyIncomeAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const sources = Array.isArray(r.sources)
    ? r.sources.map(normalizeIncomeSource).filter((s): s is OnboardingIncomeSource => s != null)
    : []
  return {
    noCurrentIncome: r.noCurrentIncome === true,
    sources,
    notes: asString(r.notes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeCashFlow(raw: unknown): OnboardingCashFlowAnswers {
  const base = emptyCashFlowAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const unknownCategories = Array.isArray(r.unknownCategories)
    ? r.unknownCategories.filter((v): v is string => typeof v === 'string')
    : []
  return {
    takeHomeIncomeCents: asMoneyCents(r.takeHomeIncomeCents),
    housingCents: asMoneyCents(r.housingCents),
    utilitiesCents: asMoneyCents(r.utilitiesCents),
    transportationCents: asMoneyCents(r.transportationCents),
    foodCents: asMoneyCents(r.foodCents),
    childcareCents: asMoneyCents(r.childcareCents),
    insurancePremiumsCents: asMoneyCents(r.insurancePremiumsCents),
    debtPaymentsCents: asMoneyCents(r.debtPaymentsCents),
    medicalCents: asMoneyCents(r.medicalCents),
    subscriptionsCents: asMoneyCents(r.subscriptionsCents),
    discretionaryCents: asMoneyCents(r.discretionaryCents),
    otherFixedCents: asMoneyCents(r.otherFixedCents),
    otherVariableCents: asMoneyCents(r.otherVariableCents),
    unknownCategories,
    notes: asString(r.notes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeAssetItem(raw: unknown): OnboardingAssetItem | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyAssetItem({
    id: asString(r.id) || createClientId(),
    category: asString(r.category) as OnboardingAssetItem['category'],
    description: asString(r.description),
    balanceCents: asMoneyCents(r.balanceCents),
    ownership: asString(r.ownership),
    liquidity: asString(r.liquidity) as OnboardingAssetItem['liquidity'],
    valueStatus: (asString(r.valueStatus) || 'estimated') as OnboardingAssetItem['valueStatus'],
    notes: asString(r.notes, 500),
  })
}

function normalizeAssets(raw: unknown): OnboardingAssetsAnswers {
  const base = emptyAssetsAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const items = Array.isArray(r.items)
    ? r.items.map(normalizeAssetItem).filter((s): s is OnboardingAssetItem => s != null)
    : []
  return {
    noAssets: r.noAssets === true,
    items,
    notes: asString(r.notes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeDebtItem(raw: unknown): OnboardingDebtItem | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyDebtItem({
    id: asString(r.id) || createClientId(),
    debtType: asString(r.debtType) as OnboardingDebtItem['debtType'],
    creditor: asString(r.creditor),
    balanceCents: asMoneyCents(r.balanceCents),
    interestRatePercent: asPercent(r.interestRatePercent),
    minimumPaymentCents: asMoneyCents(r.minimumPaymentCents),
    status: asString(r.status) as OnboardingDebtItem['status'],
    responsibleMemberId:
      typeof r.responsibleMemberId === 'string' && r.responsibleMemberId
        ? r.responsibleMemberId
        : null,
    notes: asString(r.notes, 500),
  })
}

function normalizeDebts(raw: unknown): OnboardingDebtsAnswers {
  const base = emptyDebtsAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const items = Array.isArray(r.items)
    ? r.items.map(normalizeDebtItem).filter((s): s is OnboardingDebtItem => s != null)
    : []
  return {
    noDebts: r.noDebts === true,
    items,
    notes: asString(r.notes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function asTriState(value: unknown): '' | 'yes' | 'no' | 'unknown' {
  const s = asString(value)
  if (s === 'yes' || s === 'no' || s === 'unknown') return s
  return ''
}

function asIsoDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isValidIsoDateOnly(trimmed) || trimmed === '') return null
  return trimmed
}

function normalizeInsuranceCoverage(raw: unknown): OnboardingInsuranceCoverage | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyInsuranceCoverage({
    id: asString(r.id) || createClientId(),
    coverageType: asString(r.coverageType) as OnboardingInsuranceCoverage['coverageType'],
    carrierOrProvider: asString(r.carrierOrProvider),
    insuredMemberId:
      typeof r.insuredMemberId === 'string' && r.insuredMemberId ? r.insuredMemberId : null,
    policyOrPlanType: asString(r.policyOrPlanType),
    coverageAmountCents: asMoneyCents(r.coverageAmountCents),
    premiumCents: asMoneyCents(r.premiumCents),
    premiumFrequency: asString(r.premiumFrequency) as OnboardingInsuranceCoverage['premiumFrequency'],
    employerProvided: r.employerProvided === true,
    personallyOwned: r.personallyOwned === true && r.employerProvided !== true,
    beneficiaryReviewStatus: asString(
      r.beneficiaryReviewStatus,
    ) as OnboardingInsuranceCoverage['beneficiaryReviewStatus'],
    expirationOrTerm: asString(r.expirationOrTerm, 120),
    clientReportedStatus: asString(
      r.clientReportedStatus,
    ) as OnboardingInsuranceCoverage['clientReportedStatus'],
    advisorNotes: asString(r.advisorNotes, 500),
    knownConcerns: asString(r.knownConcerns, 500),
  })
}

function normalizeInsurance(raw: unknown): OnboardingInsuranceAnswers {
  const base = emptyInsuranceAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const coverages = Array.isArray(r.coverages)
    ? r.coverages
        .map(normalizeInsuranceCoverage)
        .filter((s): s is OnboardingInsuranceCoverage => s != null)
    : []
  return {
    noCurrentCoverage: r.noCurrentCoverage === true,
    coverages,
    coverageReviewedRecently: asTriState(r.coverageReviewedRecently),
    beneficiariesReviewed: asTriState(r.beneficiariesReviewed),
    dependentsRelyOnIncome: asTriState(r.dependentsRelyOnIncome),
    existingProtectionConcerns: asString(r.existingProtectionConcerns, ADVISOR_NOTES_MAX_LENGTH),
    knownCoverageGaps: asString(r.knownCoverageGaps, ADVISOR_NOTES_MAX_LENGTH),
    advisorObservedConcerns: asString(r.advisorObservedConcerns, ADVISOR_NOTES_MAX_LENGTH),
    clientStatedConcerns: asString(r.clientStatedConcerns, ADVISOR_NOTES_MAX_LENGTH),
    protectionConcernsAcknowledged: r.protectionConcernsAcknowledged === true,
    notes: asString(r.notes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeRetirement(raw: unknown): OnboardingRetirementAnswers {
  const base = emptyRetirementAnswers()
  const r = asRecord(raw)
  if (!r) return base
  return {
    planningStatus: asString(r.planningStatus) as OnboardingRetirementAnswers['planningStatus'],
    desiredRetirementAge: asNonNegativeInt(r.desiredRetirementAge),
    desiredMonthlyIncomeCents: asMoneyCents(r.desiredMonthlyIncomeCents),
    desiredIncomeUnknown: r.desiredIncomeUnknown === true,
    currentMonthlyContributionCents: asMoneyCents(r.currentMonthlyContributionCents),
    contributionAcknowledged: r.contributionAcknowledged === true,
    employerMatchKind: asString(r.employerMatchKind) as OnboardingRetirementAnswers['employerMatchKind'],
    employerMatchPercent: asPercent(r.employerMatchPercent),
    employerMatchAmountCents: asMoneyCents(r.employerMatchAmountCents),
    pensionAvailable: asTriState(r.pensionAvailable),
    pensionNotes: asString(r.pensionNotes, 500),
    socialSecurityExpectation: asString(
      r.socialSecurityExpectation,
    ) as OnboardingRetirementAnswers['socialSecurityExpectation'],
    retirementConfidence: asString(
      r.retirementConfidence,
    ) as OnboardingRetirementAnswers['retirementConfidence'],
    primaryConcerns: asString(r.primaryConcerns, ADVISOR_NOTES_MAX_LENGTH),
    expectedLifestyle: asString(r.expectedLifestyle, 500),
    majorGoals: asString(r.majorGoals, ADVISOR_NOTES_MAX_LENGTH),
    plannedLocation: asString(r.plannedLocation, 200),
    otherAnticipatedIncome: asString(r.otherAnticipatedIncome, 500),
    advisorNotes: asString(r.advisorNotes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeEstateItem(raw: unknown): OnboardingEstatePlanningItem | null {
  const r = asRecord(raw)
  if (!r) return null
  const key = asString(r.key) as EstatePlanningItemKey
  if (!(ESTATE_PLANNING_ITEM_KEYS as readonly string[]).includes(key)) return null
  return emptyEstatePlanningItem(key, {
    status: asString(r.status) as OnboardingEstatePlanningItem['status'],
    notes: asString(r.notes, 500),
  })
}

function normalizeEstate(raw: unknown): OnboardingEstateAnswers {
  const base = emptyEstateAnswers()
  const r = asRecord(raw)
  if (!r) return base
  const parsed = Array.isArray(r.items)
    ? r.items.map(normalizeEstateItem).filter((s): s is OnboardingEstatePlanningItem => s != null)
    : []
  const byKey = new Map(parsed.map((item) => [item.key, item]))
  const items = ESTATE_PLANNING_ITEM_KEYS.map(
    (key) => byKey.get(key) ?? emptyEstatePlanningItem(key),
  )
  return {
    items,
    itemsAcknowledged: r.itemsAcknowledged === true,
    minorDependentsNeedGuardianship: asTriState(r.minorDependentsNeedGuardianship),
    legacyGoals: asString(r.legacyGoals, ADVISOR_NOTES_MAX_LENGTH),
    charitableGoals: asString(r.charitableGoals, ADVISOR_NOTES_MAX_LENGTH),
    familyTransferGoals: asString(r.familyTransferGoals, ADVISOR_NOTES_MAX_LENGTH),
    businessContinuityConcerns: asString(r.businessContinuityConcerns, ADVISOR_NOTES_MAX_LENGTH),
    finalExpenseConcerns: asString(r.finalExpenseConcerns, ADVISOR_NOTES_MAX_LENGTH),
    clientStatedConcerns: asString(r.clientStatedConcerns, ADVISOR_NOTES_MAX_LENGTH),
    advisorObservedConcerns: asString(r.advisorObservedConcerns, ADVISOR_NOTES_MAX_LENGTH),
    lastReviewDate: asIsoDateOnly(r.lastReviewDate),
    estateAttorneyRelationship: asString(r.estateAttorneyRelationship, 300),
    advisorNotes: asString(r.advisorNotes, ADVISOR_NOTES_MAX_LENGTH),
  }
}

function normalizeImmediateConcern(raw: unknown): OnboardingImmediateConcern | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyImmediateConcern({
    id: asString(r.id) || createClientId(),
    description: asString(r.description, 500),
    urgency: asString(r.urgency) as OnboardingImmediateConcern['urgency'],
    source: asString(r.source) as OnboardingImmediateConcern['source'],
    category: asString(r.category) as OnboardingImmediateConcern['category'],
    notes: asString(r.notes, 500),
  })
}

function normalizePriorityItem(raw: unknown): OnboardingPriorityItem | null {
  const r = asRecord(raw)
  if (!r) return null
  return emptyPriorityItem({
    id: asString(r.id) || createClientId(),
    rank: asNonNegativeInt(r.rank),
    title: asString(r.title, 200),
    description: asString(r.description, 500),
    timeHorizon: asString(r.timeHorizon) as OnboardingPriorityItem['timeHorizon'],
    category: asString(r.category) as OnboardingPriorityItem['category'],
    source: asString(r.source) as OnboardingPriorityItem['source'],
    targetAmountCents: asMoneyCents(r.targetAmountCents),
    targetDate: asIsoDateOnly(r.targetDate),
    status: asString(r.status) as OnboardingPriorityItem['status'],
    notes: asString(r.notes, 500),
  })
}

function normalizeGoals(raw: unknown): OnboardingGoalsAnswers {
  const base = emptyGoalsAnswers()
  const r = asRecord(raw)
  if (!r) return base
  return {
    noCurrentGoals: r.noCurrentGoals === true,
    immediateConcerns: Array.isArray(r.immediateConcerns)
      ? r.immediateConcerns
          .map(normalizeImmediateConcern)
          .filter((s): s is OnboardingImmediateConcern => s != null)
      : [],
    priorities: Array.isArray(r.priorities)
      ? r.priorities
          .map(normalizePriorityItem)
          .filter((s): s is OnboardingPriorityItem => s != null)
      : [],
    majorUpcomingEvents: asString(r.majorUpcomingEvents, ADVISOR_NOTES_MAX_LENGTH),
    longTermVision: asString(r.longTermVision, ADVISOR_NOTES_MAX_LENGTH),
    primaryMotivation: asString(r.primaryMotivation, ADVISOR_NOTES_MAX_LENGTH),
    biggestObstacle: asString(r.biggestObstacle, ADVISOR_NOTES_MAX_LENGTH),
    preferredPace: asString(r.preferredPace) as OnboardingGoalsAnswers['preferredPace'],
    advisorSummary: asString(r.advisorSummary, ADVISOR_NOTES_MAX_LENGTH),
    clientAgreesWithPriorities: asTriState(r.clientAgreesWithPriorities),
  }
}

export function createEmptyOnboardingAnswers(
  options: { startedAt?: string; lastSection?: OnboardingSectionId } = {},
): HouseholdOnboardingAnswers {
  const startedAt = options.startedAt ?? new Date().toISOString()
  return {
    meta: {
      version: HOUSEHOLD_ONBOARDING_ANSWERS_VERSION,
      startedAt,
      lastSavedAt: null,
      lastSection: options.lastSection ?? DEFAULT_ONBOARDING_SECTION_ID,
      completedSections: [],
    },
    overview: emptyOverviewAnswers(),
    members: emptyMembersAnswers(),
    income: emptyIncomeAnswers(),
    cashFlow: emptyCashFlowAnswers(),
    assets: emptyAssetsAnswers(),
    debts: emptyDebtsAnswers(),
    insurance: emptyInsuranceAnswers(),
    retirement: emptyRetirementAnswers(),
    estate: emptyEstateAnswers(),
    goals: emptyGoalsAnswers(),
  }
}

/**
 * Normalize a persisted answers document.
 * Documents without `meta` (or with partial meta) receive safe defaults.
 * Legacy empty Phase 4 objects `{}` normalize to typed defaults.
 */
export function normalizeOnboardingAnswers(
  raw: unknown,
  options: { now?: () => Date } = {},
): HouseholdOnboardingAnswers {
  const nowIso = (options.now ?? (() => new Date()))().toISOString()
  const root = asRecord(raw) ?? {}
  const metaRaw = asRecord(root.meta)

  const startedAt = parseIsoTimestamp(metaRaw?.startedAt, nowIso)
  const lastSavedAt = parseNullableIsoTimestamp(metaRaw?.lastSavedAt)
  const lastSectionRaw = metaRaw?.lastSection
  const lastSection =
    typeof lastSectionRaw === 'string' && isOnboardingSectionId(lastSectionRaw)
      ? lastSectionRaw
      : DEFAULT_ONBOARDING_SECTION_ID

  const versionRaw = metaRaw?.version
  const version =
    typeof versionRaw === 'number' && Number.isFinite(versionRaw) && versionRaw > 0
      ? Math.floor(versionRaw)
      : HOUSEHOLD_ONBOARDING_ANSWERS_VERSION

  const meta: HouseholdOnboardingMeta = {
    version,
    startedAt,
    lastSavedAt,
    lastSection,
    completedSections: parseCompletedSections(metaRaw?.completedSections),
  }

  return {
    meta,
    overview: normalizeOverview(root.overview),
    members: normalizeMembers(root.members),
    income: normalizeIncome(root.income),
    cashFlow: normalizeCashFlow(root.cashFlow),
    assets: normalizeAssets(root.assets),
    debts: normalizeDebts(root.debts),
    insurance: normalizeInsurance(root.insurance),
    retirement: normalizeRetirement(root.retirement),
    estate: normalizeEstate(root.estate),
    goals: normalizeGoals(root.goals),
  }
}
