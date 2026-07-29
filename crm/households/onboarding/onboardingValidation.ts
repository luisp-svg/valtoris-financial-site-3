import type { CrmHouseholdDetail, HouseholdMemberSummary } from '../types'
import {
  ADVISOR_NOTES_MAX_LENGTH,
  FORM_SECTION_IDS,
  type FormSectionId,
  type HouseholdOnboardingAnswers,
  type OnboardingCashFlowAnswers,
  type Phase3SectionId,
  PHASE3_SECTION_IDS,
} from './onboardingFormTypes'
import {
  countKnownRetirementAssetBalances,
  getPrimaryMemberAge,
  hasBusinessOwnershipAsset,
  householdHasIncomeDependentsContext,
  isValidIsoDateOnly,
} from './onboardingCrossSection'
import {
  centsOrZeroForTotal,
  sumKnownCents,
  type MoneyCents,
} from './onboardingMoney'
import type { OnboardingSectionUiState } from './onboardingProgress'
import type { OnboardingSectionId } from './onboardingSections'

export type SectionValidationResult = {
  status: OnboardingSectionUiState
  errors: Record<string, string>
  warnings: Record<string, string>
  missingRequiredFields: string[]
}

export type OnboardingValidationContext = {
  household: CrmHouseholdDetail
}

function emptyResult(status: OnboardingSectionUiState = 'not_started'): SectionValidationResult {
  return { status, errors: {}, warnings: {}, missingRequiredFields: [] }
}

function finalize(
  errors: Record<string, string>,
  warnings: Record<string, string>,
  missingRequiredFields: string[],
  started: boolean,
): SectionValidationResult {
  if (Object.keys(errors).length > 0) {
    return { status: 'needs_attention', errors, warnings, missingRequiredFields }
  }
  if (missingRequiredFields.length === 0) {
    return { status: 'complete', errors, warnings, missingRequiredFields }
  }
  if (started) {
    return { status: 'in_progress', errors, warnings, missingRequiredFields }
  }
  return {
    status: 'not_started',
    errors,
    warnings,
    missingRequiredFields,
  }
}

function rejectNegativeCents(
  errors: Record<string, string>,
  field: string,
  cents: MoneyCents,
  label: string,
) {
  if (cents != null && cents < 0) {
    errors[field] = `${label} cannot be negative.`
  }
}

export function validateOverviewSection(
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  const overview = answers.overview
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  if (!context.household.id) missing.push('household')
  if (!context.household.display_name.trim()) missing.push('householdName')

  const started =
    overview.maritalOrHouseholdStatus !== '' ||
    overview.dependentsCount != null ||
    overview.preferredContactMethod !== '' ||
    overview.advisorNotes.trim() !== '' ||
    overview.additionalContext.trim() !== ''

  if (!overview.maritalOrHouseholdStatus) missing.push('maritalOrHouseholdStatus')
  if (overview.dependentsCount == null) missing.push('dependentsCount')
  if (!overview.preferredContactMethod) missing.push('preferredContactMethod')

  if (overview.advisorNotes.length > ADVISOR_NOTES_MAX_LENGTH) {
    errors.advisorNotes = `Notes must be ${ADVISOR_NOTES_MAX_LENGTH} characters or fewer.`
  }
  if (overview.additionalContext.length > ADVISOR_NOTES_MAX_LENGTH) {
    errors.additionalContext = `Context must be ${ADVISOR_NOTES_MAX_LENGTH} characters or fewer.`
  }

  return finalize(errors, warnings, missing, started)
}

export function validateMembersSection(
  _answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []
  const members = context.household.members

  if (members.length === 0) {
    missing.push('activeMembers')
    return finalize(errors, warnings, missing, false)
  }

  const hasPrimary = members.some((m) => m.is_primary_contact)
  if (!hasPrimary) missing.push('primaryContact')

  members.forEach((member, index) => {
    if (!member.first_name.trim() || !member.last_name.trim()) {
      errors[`member_${member.id || index}_name`] = 'Each member needs a first and last name.'
    }
    if (!member.relationship) {
      errors[`member_${member.id || index}_relationship`] = 'Each member needs a relationship.'
    }
  })

  const started = true
  return finalize(errors, warnings, missing, started)
}

export function validateIncomeSection(answers: HouseholdOnboardingAnswers): SectionValidationResult {
  const income = answers.income
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const started =
    income.noCurrentIncome ||
    income.sources.length > 0 ||
    income.notes.trim() !== ''

  if (income.noCurrentIncome) {
    if (income.sources.length > 0) {
      warnings.sources = 'No-current-income is selected while income sources are listed.'
    }
    return finalize(errors, warnings, missing, started)
  }

  if (income.sources.length === 0) {
    missing.push('incomeSourcesOrNoIncome')
    return finalize(errors, warnings, missing, started)
  }

  income.sources.forEach((source, index) => {
    const prefix = `source_${source.id || index}`
    if (!source.employmentStatus && !source.employerOrSourceName.trim()) {
      missing.push(`${prefix}_classification`)
    }
    const hasAmount =
      source.grossAnnualIncomeCents != null ||
      source.netMonthlyIncomeCents != null ||
      source.variableOrCommissionIncomeCents != null ||
      source.otherIncomeCents != null
    if (!hasAmount) {
      missing.push(`${prefix}_amount`)
    }
    rejectNegativeCents(errors, `${prefix}_gross`, source.grossAnnualIncomeCents, 'Gross annual income')
    rejectNegativeCents(errors, `${prefix}_net`, source.netMonthlyIncomeCents, 'Net monthly income')
    rejectNegativeCents(
      errors,
      `${prefix}_variable`,
      source.variableOrCommissionIncomeCents,
      'Variable/commission income',
    )
    rejectNegativeCents(errors, `${prefix}_other`, source.otherIncomeCents, 'Other income')
  })

  return finalize(errors, warnings, missing, started)
}

export const CASH_FLOW_EXPENSE_KEYS = [
  'housingCents',
  'utilitiesCents',
  'transportationCents',
  'foodCents',
  'childcareCents',
  'insurancePremiumsCents',
  'debtPaymentsCents',
  'medicalCents',
  'subscriptionsCents',
  'discretionaryCents',
  'otherFixedCents',
  'otherVariableCents',
] as const satisfies readonly (keyof OnboardingCashFlowAnswers)[]

export function computeCashFlowTotals(cashFlow: OnboardingCashFlowAnswers): {
  totalExpensesCents: number
  surplusOrDeficitCents: number | null
} {
  const expenseValues = CASH_FLOW_EXPENSE_KEYS.map(
    (key) => cashFlow[key] as MoneyCents,
  )
  const totalExpensesCents = sumKnownCents(
    expenseValues.map((v) => centsOrZeroForTotal(v)),
  )
  if (cashFlow.takeHomeIncomeCents == null) {
    return { totalExpensesCents, surplusOrDeficitCents: null }
  }
  return {
    totalExpensesCents,
    surplusOrDeficitCents: cashFlow.takeHomeIncomeCents - totalExpensesCents,
  }
}

export function validateCashFlowSection(
  answers: HouseholdOnboardingAnswers,
): SectionValidationResult {
  const cashFlow = answers.cashFlow
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const anyExpense = CASH_FLOW_EXPENSE_KEYS.some((key) => cashFlow[key] != null)
  const started =
    cashFlow.takeHomeIncomeCents != null ||
    anyExpense ||
    cashFlow.unknownCategories.length > 0 ||
    cashFlow.notes.trim() !== ''

  if (cashFlow.takeHomeIncomeCents == null) missing.push('takeHomeIncomeCents')
  rejectNegativeCents(errors, 'takeHomeIncomeCents', cashFlow.takeHomeIncomeCents, 'Take-home income')

  const coreKeys = ['housingCents', 'utilitiesCents', 'foodCents', 'transportationCents'] as const
  for (const key of coreKeys) {
    const acknowledged =
      cashFlow[key] != null || cashFlow.unknownCategories.includes(key)
    if (!acknowledged) missing.push(key)
  }

  for (const key of CASH_FLOW_EXPENSE_KEYS) {
    rejectNegativeCents(errors, key, cashFlow[key] as MoneyCents, 'Expense amount')
  }

  return finalize(errors, warnings, missing, started)
}

export function computeKnownAssetTotalCents(answers: HouseholdOnboardingAnswers): number {
  return sumKnownCents(answers.assets.items.map((item) => item.balanceCents))
}

export function validateAssetsSection(answers: HouseholdOnboardingAnswers): SectionValidationResult {
  const assets = answers.assets
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const started =
    assets.noAssets || assets.items.length > 0 || assets.notes.trim() !== ''

  if (assets.noAssets) {
    if (assets.items.length > 0) {
      warnings.items = 'No-assets is selected while assets are listed.'
    }
    return finalize(errors, warnings, missing, started)
  }

  if (assets.items.length === 0) {
    missing.push('assetsOrNoAssets')
    return finalize(errors, warnings, missing, started)
  }

  assets.items.forEach((item, index) => {
    const prefix = `asset_${item.id || index}`
    if (!item.category) {
      missing.push(`${prefix}_category`)
    }
    rejectNegativeCents(errors, `${prefix}_balance`, item.balanceCents, 'Asset balance')
  })

  return finalize(errors, warnings, missing, started)
}

export function computeKnownDebtTotals(answers: HouseholdOnboardingAnswers): {
  totalBalanceCents: number
  totalMinimumPaymentCents: number
} {
  return {
    totalBalanceCents: sumKnownCents(answers.debts.items.map((d) => d.balanceCents)),
    totalMinimumPaymentCents: sumKnownCents(
      answers.debts.items.map((d) => d.minimumPaymentCents),
    ),
  }
}

export function validateDebtsSection(answers: HouseholdOnboardingAnswers): SectionValidationResult {
  const debts = answers.debts
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const started = debts.noDebts || debts.items.length > 0 || debts.notes.trim() !== ''

  if (debts.noDebts) {
    if (debts.items.length > 0) {
      warnings.items = 'No-debt is selected while debts are listed.'
    }
    return finalize(errors, warnings, missing, started)
  }

  if (debts.items.length === 0) {
    missing.push('debtsOrNoDebts')
    return finalize(errors, warnings, missing, started)
  }

  debts.items.forEach((item, index) => {
    const prefix = `debt_${item.id || index}`
    if (!item.debtType) {
      missing.push(`${prefix}_type`)
    }
    rejectNegativeCents(errors, `${prefix}_balance`, item.balanceCents, 'Debt balance')
    rejectNegativeCents(
      errors,
      `${prefix}_minimum`,
      item.minimumPaymentCents,
      'Minimum payment',
    )
    if (item.interestRatePercent != null && (item.interestRatePercent < 0 || item.interestRatePercent > 100)) {
      errors[`${prefix}_rate`] = 'Interest rate must be between 0 and 100.'
    }
  })

  return finalize(errors, warnings, missing, started)
}

export function validateInsuranceSection(
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  const insurance = answers.insurance
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const started =
    insurance.noCurrentCoverage ||
    insurance.coverages.length > 0 ||
    insurance.protectionConcernsAcknowledged ||
    insurance.coverageReviewedRecently !== '' ||
    insurance.beneficiariesReviewed !== '' ||
    insurance.dependentsRelyOnIncome !== '' ||
    insurance.existingProtectionConcerns.trim() !== '' ||
    insurance.knownCoverageGaps.trim() !== '' ||
    insurance.clientStatedConcerns.trim() !== '' ||
    insurance.advisorObservedConcerns.trim() !== '' ||
    insurance.notes.trim() !== ''

  if (householdHasIncomeDependentsContext(answers, context.household)) {
    warnings.dependentsIncome =
      'Household appears to have dependents who may rely on income. Review protection coverage educationally against current policies.'
  }

  if (insurance.noCurrentCoverage) {
    if (insurance.coverages.length > 0) {
      warnings.coverages = 'No-current-coverage is selected while coverage entries are listed.'
    }
  } else if (insurance.coverages.length === 0) {
    missing.push('coveragesOrNoCoverage')
  }

  if (!insurance.protectionConcernsAcknowledged) {
    missing.push('protectionConcernsAcknowledged')
  }

  insurance.coverages.forEach((item, index) => {
    const prefix = `coverage_${item.id || index}`
    if (!item.coverageType) missing.push(`${prefix}_type`)
    rejectNegativeCents(errors, `${prefix}_amount`, item.coverageAmountCents, 'Coverage amount')
    rejectNegativeCents(errors, `${prefix}_premium`, item.premiumCents, 'Premium')
    if (item.employerProvided && item.personallyOwned) {
      errors[`${prefix}_ownership`] =
        'Employer-provided coverage should not also be marked as personally owned.'
    }
  })

  return finalize(errors, warnings, missing, started)
}

export function validateRetirementSection(
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  const retirement = answers.retirement
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []
  const currentAge = getPrimaryMemberAge(context.household)
  const retirementAssets = countKnownRetirementAssetBalances(answers)

  const started =
    retirement.planningStatus !== '' ||
    retirement.desiredRetirementAge != null ||
    retirement.desiredMonthlyIncomeCents != null ||
    retirement.desiredIncomeUnknown ||
    retirement.currentMonthlyContributionCents != null ||
    retirement.contributionAcknowledged ||
    retirement.employerMatchKind !== '' ||
    retirement.pensionAvailable !== '' ||
    retirement.socialSecurityExpectation !== '' ||
    retirement.retirementConfidence !== '' ||
    retirement.primaryConcerns.trim() !== '' ||
    retirement.majorGoals.trim() !== '' ||
    retirement.advisorNotes.trim() !== ''

  if (!retirement.planningStatus) missing.push('planningStatus')

  const ageNotRequired =
    retirement.planningStatus === 'already_retired' ||
    retirement.planningStatus === 'uncertain' ||
    retirement.planningStatus === 'not_yet_planning' ||
    retirement.planningStatus === ''

  if (!ageNotRequired && retirement.desiredRetirementAge == null) {
    missing.push('desiredRetirementAge')
  }

  if (retirement.desiredRetirementAge != null) {
    if (retirement.desiredRetirementAge < 18 || retirement.desiredRetirementAge > 100) {
      errors.desiredRetirementAge = 'Desired retirement age must be between 18 and 100.'
    } else if (
      currentAge != null &&
      retirement.planningStatus !== 'already_retired' &&
      retirement.desiredRetirementAge < currentAge
    ) {
      errors.desiredRetirementAge =
        'Desired retirement age cannot be below the primary member’s current age unless already retired.'
    }
  }

  if (!retirement.desiredIncomeUnknown && retirement.desiredMonthlyIncomeCents == null) {
    missing.push('desiredMonthlyIncome')
  }
  rejectNegativeCents(
    errors,
    'desiredMonthlyIncomeCents',
    retirement.desiredMonthlyIncomeCents,
    'Desired retirement income',
  )

  if (
    !retirement.contributionAcknowledged &&
    retirement.currentMonthlyContributionCents == null &&
    retirement.planningStatus !== 'already_retired' &&
    retirement.planningStatus !== 'not_yet_planning'
  ) {
    missing.push('contributionBehavior')
  }
  rejectNegativeCents(
    errors,
    'currentMonthlyContributionCents',
    retirement.currentMonthlyContributionCents,
    'Monthly contribution',
  )
  rejectNegativeCents(
    errors,
    'employerMatchAmountCents',
    retirement.employerMatchAmountCents,
    'Employer match amount',
  )
  if (
    retirement.employerMatchPercent != null &&
    (retirement.employerMatchPercent < 0 || retirement.employerMatchPercent > 100)
  ) {
    errors.employerMatchPercent = 'Employer match percent must be between 0 and 100.'
  }

  if (
    retirement.retirementConfidence === '' &&
    retirement.primaryConcerns.trim() === '' &&
    retirement.planningStatus !== 'not_yet_planning'
  ) {
    missing.push('confidenceOrConcerns')
  }

  if (retirementAssets.count > 0) {
    warnings.retirementAssets =
      'Retirement account balances are captured in Assets and Savings. This section focuses on planning assumptions, not duplicated balances.'
  }

  return finalize(errors, warnings, missing, started)
}

export function validateEstateSection(
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  const estate = answers.estate
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const anyStatus = estate.items.some((item) => item.status !== '')
  const started =
    anyStatus ||
    estate.itemsAcknowledged ||
    estate.minorDependentsNeedGuardianship !== '' ||
    estate.legacyGoals.trim() !== '' ||
    estate.charitableGoals.trim() !== '' ||
    estate.familyTransferGoals.trim() !== '' ||
    estate.clientStatedConcerns.trim() !== '' ||
    estate.advisorObservedConcerns.trim() !== '' ||
    estate.lastReviewDate != null ||
    estate.advisorNotes.trim() !== ''

  if (!estate.itemsAcknowledged && !anyStatus) {
    missing.push('estateItemsReviewed')
  }

  const requiredKeys = new Set([
    'will',
    'financial_poa',
    'healthcare_poa',
    'advance_directive',
    'beneficiary_review',
  ])
  if (householdHasIncomeDependentsContext(answers, context.household)) {
    requiredKeys.add('guardianship_plan')
  }
  if (hasBusinessOwnershipAsset(answers)) {
    requiredKeys.add('business_succession')
  }

  if (estate.itemsAcknowledged || anyStatus) {
    for (const item of estate.items) {
      if (!requiredKeys.has(item.key)) continue
      if (item.status === '') missing.push(`estate_${item.key}_status`)
    }
  }

  const legacyAcknowledged =
    estate.legacyGoals.trim() !== '' ||
    estate.charitableGoals.trim() !== '' ||
    estate.familyTransferGoals.trim() !== '' ||
    estate.clientStatedConcerns.trim() !== '' ||
    estate.advisorObservedConcerns.trim() !== '' ||
    estate.finalExpenseConcerns.trim() !== ''
  if (!legacyAcknowledged && started) missing.push('legacyGoalsOrConcerns')

  if (estate.lastReviewDate != null && !isValidIsoDateOnly(estate.lastReviewDate)) {
    errors.lastReviewDate = 'Enter a valid review date (YYYY-MM-DD).'
  }

  if (householdHasIncomeDependentsContext(answers, context.household)) {
    const guardianship = estate.items.find((item) => item.key === 'guardianship_plan')
    if (
      !guardianship ||
      guardianship.status === '' ||
      guardianship.status === 'not_in_place' ||
      guardianship.status === 'unknown'
    ) {
      warnings.guardianship =
        'Minor dependents or dependents were indicated. Review guardianship planning educationally with qualified counsel when appropriate.'
    }
  }

  if (hasBusinessOwnershipAsset(answers)) {
    warnings.businessSuccession =
      'A business ownership asset was listed. Business succession and related agreements may be relevant for educational review.'
  }

  return finalize(errors, warnings, missing, started)
}

export function validateGoalsSection(answers: HouseholdOnboardingAnswers): SectionValidationResult {
  const goals = answers.goals
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const missing: string[] = []

  const started =
    goals.noCurrentGoals ||
    goals.immediateConcerns.length > 0 ||
    goals.priorities.length > 0 ||
    goals.primaryMotivation.trim() !== '' ||
    goals.longTermVision.trim() !== '' ||
    goals.majorUpcomingEvents.trim() !== '' ||
    goals.advisorSummary.trim() !== ''

  const clientStatedGoal =
    goals.immediateConcerns.some((c) => c.source === 'client_stated' && c.description.trim()) ||
    goals.priorities.some((p) => p.source === 'client_stated' && p.title.trim())

  if (goals.noCurrentGoals) {
    if (goals.priorities.length > 0 || goals.immediateConcerns.length > 0) {
      warnings.goals = 'No-current-goals is selected while goals or priorities are listed.'
    }
  } else if (!clientStatedGoal) {
    missing.push('clientStatedGoalOrNoGoals')
  }

  if (!goals.noCurrentGoals && goals.priorities.length === 0) {
    missing.push('rankedPriority')
  }

  const ranks = goals.priorities
    .map((p) => p.rank)
    .filter((rank): rank is number => rank != null)
  const rankSet = new Set(ranks)
  if (ranks.length !== rankSet.size) {
    errors.priorityRanks = 'Priority rankings must be unique.'
  }

  goals.priorities.forEach((item, index) => {
    const prefix = `priority_${item.id || index}`
    if (!item.title.trim()) missing.push(`${prefix}_title`)
    if (item.rank == null) missing.push(`${prefix}_rank`)
    if (item.rank != null && item.rank < 1) {
      errors[`${prefix}_rank`] = 'Rank must be 1 or greater.'
    }
    const validHorizons = new Set([
      '',
      'immediate',
      '30_days',
      '90_days',
      '12_months',
      '1_3_years',
      'long_term',
    ])
    if (!validHorizons.has(item.timeHorizon)) {
      errors[`${prefix}_horizon`] = 'Select a valid time horizon.'
    }
    rejectNegativeCents(errors, `${prefix}_target`, item.targetAmountCents, 'Target amount')
    if (item.targetDate != null && !isValidIsoDateOnly(item.targetDate)) {
      errors[`${prefix}_date`] = 'Enter a valid target date (YYYY-MM-DD).'
    }
    if (!item.id) errors[`${prefix}_id`] = 'Priority is missing a stable id.'
  })

  goals.immediateConcerns.forEach((item, index) => {
    const prefix = `concern_${item.id || index}`
    if (!item.description.trim()) missing.push(`${prefix}_description`)
    if (!item.id) errors[`${prefix}_id`] = 'Concern is missing a stable id.'
  })

  if (
    !goals.noCurrentGoals &&
    goals.primaryMotivation.trim() === '' &&
    goals.immediateConcerns.length === 0
  ) {
    missing.push('primaryMotivationOrConcerns')
  }

  return finalize(errors, warnings, missing, started)
}

export function validateOnboardingSection(
  sectionId: OnboardingSectionId,
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): SectionValidationResult {
  switch (sectionId) {
    case 'overview':
      return validateOverviewSection(answers, context)
    case 'members':
      return validateMembersSection(answers, context)
    case 'income':
      return validateIncomeSection(answers)
    case 'cash-flow':
      return validateCashFlowSection(answers)
    case 'assets':
      return validateAssetsSection(answers)
    case 'debts':
      return validateDebtsSection(answers)
    case 'insurance':
      return validateInsuranceSection(answers, context)
    case 'retirement':
      return validateRetirementSection(answers, context)
    case 'estate':
      return validateEstateSection(answers, context)
    case 'goals':
      return validateGoalsSection(answers)
    case 'review':
      // Review has no form payload. Progress/completion modules derive review readiness.
      return emptyResult('not_started')
    default:
      return emptyResult('not_started')
  }
}

export function isPhase3SectionId(id: OnboardingSectionId): id is Phase3SectionId {
  return (PHASE3_SECTION_IDS as readonly string[]).includes(id)
}

export function isFormSectionId(id: OnboardingSectionId): id is FormSectionId {
  return (FORM_SECTION_IDS as readonly string[]).includes(id)
}

export function memberDisplayLabel(member: HouseholdMemberSummary): string {
  return `${member.first_name} ${member.last_name}`.trim()
}
