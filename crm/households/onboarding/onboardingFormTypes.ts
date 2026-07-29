import type { OnboardingSectionId } from './onboardingSections'
import type { MoneyCents } from './onboardingMoney'

/** Current onboarding answers document version. */
export const HOUSEHOLD_ONBOARDING_ANSWERS_VERSION = 1 as const

export const ADVISOR_NOTES_MAX_LENGTH = 2000

export type HouseholdOnboardingMeta = {
  version: number
  startedAt: string
  lastSavedAt: string | null
  lastSection: OnboardingSectionId
  completedSections: OnboardingSectionId[]
}

export type MaritalOrHouseholdStatus =
  | 'single'
  | 'married'
  | 'domestic_partnership'
  | 'divorced'
  | 'widowed'
  | 'other'
  | ''

export type PreferredContactMethodOnboarding =
  | 'email'
  | 'phone'
  | 'text'
  | 'video'
  | 'in_person'
  | ''

export type OnboardingOverviewAnswers = {
  maritalOrHouseholdStatus: MaritalOrHouseholdStatus
  /** null = missing; 0 = explicit zero dependents */
  dependentsCount: number | null
  preferredContactMethod: PreferredContactMethodOnboarding
  advisorNotes: string
  additionalContext: string
}

/** Intake-only member notes — CRM members remain authoritative. */
export type OnboardingMembersAnswers = {
  advisorMemberNotes: string
}

export type EmploymentStatus =
  | 'employed_full_time'
  | 'employed_part_time'
  | 'self_employed'
  | 'contract'
  | 'unemployed'
  | 'retired'
  | 'other'
  | ''

export type PayFrequency =
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'annual'
  | 'variable'
  | ''

export type OnboardingIncomeSource = {
  id: string
  memberId: string | null
  employerOrSourceName: string
  occupation: string
  employmentStatus: EmploymentStatus
  grossAnnualIncomeCents: MoneyCents
  netMonthlyIncomeCents: MoneyCents
  payFrequency: PayFrequency
  variableOrCommissionIncomeCents: MoneyCents
  otherIncomeCents: MoneyCents
  expectedIncomeChanges: string
  employerBenefitsNotes: string
  notes: string
}

export type OnboardingIncomeAnswers = {
  /** Explicit honest state when household currently has no income. */
  noCurrentIncome: boolean
  sources: OnboardingIncomeSource[]
  notes: string
}

export type OnboardingCashFlowAnswers = {
  takeHomeIncomeCents: MoneyCents
  housingCents: MoneyCents
  utilitiesCents: MoneyCents
  transportationCents: MoneyCents
  foodCents: MoneyCents
  childcareCents: MoneyCents
  insurancePremiumsCents: MoneyCents
  debtPaymentsCents: MoneyCents
  medicalCents: MoneyCents
  subscriptionsCents: MoneyCents
  discretionaryCents: MoneyCents
  otherFixedCents: MoneyCents
  otherVariableCents: MoneyCents
  /** Categories intentionally left unknown (not forced to zero). */
  unknownCategories: string[]
  notes: string
}

export type AssetCategory =
  | 'checking'
  | 'savings'
  | 'high_yield_savings'
  | 'emergency_fund'
  | 'brokerage'
  | 'retirement_account'
  | 'hsa'
  | 'real_estate'
  | 'business_ownership'
  | 'vehicle'
  | 'other'
  | ''

export type AssetLiquidity = 'liquid' | 'mixed' | 'illiquid' | 'unknown' | ''
export type AssetValueStatus = 'estimated' | 'client_provided' | ''

export type OnboardingAssetItem = {
  id: string
  category: AssetCategory
  description: string
  balanceCents: MoneyCents
  ownership: string
  liquidity: AssetLiquidity
  valueStatus: AssetValueStatus
  notes: string
}

export type OnboardingAssetsAnswers = {
  noAssets: boolean
  items: OnboardingAssetItem[]
  notes: string
}

export type DebtType =
  | 'mortgage'
  | 'home_equity'
  | 'auto_loan'
  | 'credit_card'
  | 'student_loan'
  | 'personal_loan'
  | 'business_debt'
  | 'medical_debt'
  | 'tax_debt'
  | 'other'
  | ''

export type DebtStatus =
  | 'current'
  | 'past_due'
  | 'in_collections'
  | 'deferred'
  | 'unknown'
  | ''

export type OnboardingDebtItem = {
  id: string
  debtType: DebtType
  creditor: string
  balanceCents: MoneyCents
  /** Percentage points, e.g. 4.5 means 4.5%. */
  interestRatePercent: number | null
  minimumPaymentCents: MoneyCents
  status: DebtStatus
  responsibleMemberId: string | null
  notes: string
}

export type OnboardingDebtsAnswers = {
  noDebts: boolean
  items: OnboardingDebtItem[]
  notes: string
}

/** ----- Phase 4: Insurance / Retirement / Estate / Goals ----- */

export type InsuranceCoverageType =
  | 'life'
  | 'disability'
  | 'health'
  | 'long_term_care'
  | 'homeowners_renters'
  | 'auto'
  | 'umbrella'
  | 'employer_benefits'
  | 'business_protection'
  | 'other'
  | ''

export type PremiumFrequency = 'monthly' | 'annual' | 'unknown' | ''

export type BeneficiaryReviewStatus =
  | 'reviewed'
  | 'not_reviewed'
  | 'unknown'
  | 'not_applicable'
  | ''

export type ClientReportedCoverageStatus =
  | 'active'
  | 'lapsed'
  | 'pending'
  | 'unknown'
  | ''

export type TriStateAck = 'yes' | 'no' | 'unknown' | ''

export type OnboardingInsuranceCoverage = {
  id: string
  coverageType: InsuranceCoverageType
  carrierOrProvider: string
  insuredMemberId: string | null
  policyOrPlanType: string
  coverageAmountCents: MoneyCents
  premiumCents: MoneyCents
  premiumFrequency: PremiumFrequency
  employerProvided: boolean
  personallyOwned: boolean
  beneficiaryReviewStatus: BeneficiaryReviewStatus
  expirationOrTerm: string
  clientReportedStatus: ClientReportedCoverageStatus
  advisorNotes: string
  knownConcerns: string
}

export type OnboardingInsuranceAnswers = {
  noCurrentCoverage: boolean
  coverages: OnboardingInsuranceCoverage[]
  coverageReviewedRecently: TriStateAck
  beneficiariesReviewed: TriStateAck
  dependentsRelyOnIncome: TriStateAck
  existingProtectionConcerns: string
  knownCoverageGaps: string
  advisorObservedConcerns: string
  clientStatedConcerns: string
  protectionConcernsAcknowledged: boolean
  notes: string
}

export type RetirementPlanningStatus =
  | 'not_yet_planning'
  | 'early_planning'
  | 'actively_saving'
  | 'nearing_retirement'
  | 'already_retired'
  | 'uncertain'
  | ''

export type SocialSecurityExpectation =
  | 'expected'
  | 'not_expected'
  | 'uncertain'
  | 'not_discussed'
  | ''

export type RetirementConfidence =
  | 'very_confident'
  | 'somewhat_confident'
  | 'uncertain'
  | 'not_confident'
  | 'not_discussed'
  | ''

export type EmployerMatchKind = 'percent' | 'amount' | 'none' | 'unknown' | ''

export type OnboardingRetirementAnswers = {
  planningStatus: RetirementPlanningStatus
  desiredRetirementAge: number | null
  desiredMonthlyIncomeCents: MoneyCents
  desiredIncomeUnknown: boolean
  currentMonthlyContributionCents: MoneyCents
  contributionAcknowledged: boolean
  employerMatchKind: EmployerMatchKind
  employerMatchPercent: number | null
  employerMatchAmountCents: MoneyCents
  pensionAvailable: TriStateAck
  pensionNotes: string
  socialSecurityExpectation: SocialSecurityExpectation
  retirementConfidence: RetirementConfidence
  primaryConcerns: string
  expectedLifestyle: string
  majorGoals: string
  plannedLocation: string
  otherAnticipatedIncome: string
  advisorNotes: string
}

export type EstatePlanningItemKey =
  | 'will'
  | 'revocable_living_trust'
  | 'other_trust'
  | 'financial_poa'
  | 'healthcare_poa'
  | 'advance_directive'
  | 'guardianship_plan'
  | 'beneficiary_review'
  | 'final_expense_plan'
  | 'business_succession'
  | 'buy_sell_agreement'
  | 'key_person_planning'
  | 'digital_asset_plan'
  | 'document_organization'
  | 'other'

export type EstateItemStatus =
  | 'in_place'
  | 'needs_review'
  | 'not_in_place'
  | 'not_applicable'
  | 'unknown'
  | ''

export type OnboardingEstatePlanningItem = {
  key: EstatePlanningItemKey
  status: EstateItemStatus
  notes: string
}

export type OnboardingEstateAnswers = {
  items: OnboardingEstatePlanningItem[]
  itemsAcknowledged: boolean
  minorDependentsNeedGuardianship: TriStateAck
  legacyGoals: string
  charitableGoals: string
  familyTransferGoals: string
  businessContinuityConcerns: string
  finalExpenseConcerns: string
  clientStatedConcerns: string
  advisorObservedConcerns: string
  lastReviewDate: string | null
  estateAttorneyRelationship: string
  advisorNotes: string
}

export type GoalSource = 'client_stated' | 'advisor_observed' | ''

export type GoalUrgency = 'low' | 'medium' | 'high' | 'critical' | ''

export type GoalTimeHorizon =
  | 'immediate'
  | '30_days'
  | '90_days'
  | '12_months'
  | '1_3_years'
  | 'long_term'
  | ''

export type GoalCategory =
  | 'cash_flow'
  | 'emergency_fund'
  | 'debt'
  | 'credit'
  | 'protection'
  | 'retirement'
  | 'estate_legacy'
  | 'homeownership'
  | 'education'
  | 'business'
  | 'tax_planning'
  | 'major_purchase'
  | 'other'
  | ''

export type GoalPriorityStatus =
  | 'identified'
  | 'in_progress'
  | 'deferred'
  | 'completed'
  | 'unknown'
  | ''

export type ImplementationPace =
  | 'urgent'
  | 'steady'
  | 'gradual'
  | 'exploratory'
  | ''

export type OnboardingImmediateConcern = {
  id: string
  description: string
  urgency: GoalUrgency
  source: GoalSource
  category: GoalCategory
  notes: string
}

export type OnboardingPriorityItem = {
  id: string
  rank: number | null
  title: string
  description: string
  timeHorizon: GoalTimeHorizon
  category: GoalCategory
  source: GoalSource
  targetAmountCents: MoneyCents
  targetDate: string | null
  status: GoalPriorityStatus
  notes: string
}

export type OnboardingGoalsAnswers = {
  noCurrentGoals: boolean
  immediateConcerns: OnboardingImmediateConcern[]
  priorities: OnboardingPriorityItem[]
  majorUpcomingEvents: string
  longTermVision: string
  primaryMotivation: string
  biggestObstacle: string
  preferredPace: ImplementationPace
  advisorSummary: string
  clientAgreesWithPriorities: TriStateAck
}

/**
 * Household Onboarding answers document stored in `assessments.answers`.
 */
export type HouseholdOnboardingAnswers = {
  meta: HouseholdOnboardingMeta
  overview: OnboardingOverviewAnswers
  members: OnboardingMembersAnswers
  income: OnboardingIncomeAnswers
  cashFlow: OnboardingCashFlowAnswers
  assets: OnboardingAssetsAnswers
  debts: OnboardingDebtsAnswers
  insurance: OnboardingInsuranceAnswers
  retirement: OnboardingRetirementAnswers
  estate: OnboardingEstateAnswers
  goals: OnboardingGoalsAnswers
}

/** Maps section ids to answers document keys (review has no dedicated payload). */
export const ONBOARDING_SECTION_ANSWER_KEYS = {
  overview: 'overview',
  members: 'members',
  income: 'income',
  'cash-flow': 'cashFlow',
  assets: 'assets',
  debts: 'debts',
  insurance: 'insurance',
  retirement: 'retirement',
  estate: 'estate',
  goals: 'goals',
  review: null,
} as const satisfies Record<OnboardingSectionId, keyof HouseholdOnboardingAnswers | null>

export const PHASE3_SECTION_IDS = [
  'overview',
  'members',
  'income',
  'cash-flow',
  'assets',
  'debts',
] as const satisfies readonly OnboardingSectionId[]

export type Phase3SectionId = (typeof PHASE3_SECTION_IDS)[number]

export const PHASE4_SECTION_IDS = [
  'insurance',
  'retirement',
  'estate',
  'goals',
] as const satisfies readonly OnboardingSectionId[]

export type Phase4SectionId = (typeof PHASE4_SECTION_IDS)[number]

/** All form sections with real validation (excludes Financial Progress Review). */
export const FORM_SECTION_IDS = [
  ...PHASE3_SECTION_IDS,
  ...PHASE4_SECTION_IDS,
] as const satisfies readonly OnboardingSectionId[]

export type FormSectionId = (typeof FORM_SECTION_IDS)[number]

export const ESTATE_PLANNING_ITEM_KEYS = [
  'will',
  'revocable_living_trust',
  'other_trust',
  'financial_poa',
  'healthcare_poa',
  'advance_directive',
  'guardianship_plan',
  'beneficiary_review',
  'final_expense_plan',
  'business_succession',
  'buy_sell_agreement',
  'key_person_planning',
  'digital_asset_plan',
  'document_organization',
  'other',
] as const satisfies readonly EstatePlanningItemKey[]

export const ESTATE_PLANNING_ITEM_LABELS: Record<EstatePlanningItemKey, string> = {
  will: 'Will',
  revocable_living_trust: 'Revocable living trust',
  other_trust: 'Other trust',
  financial_poa: 'Financial power of attorney',
  healthcare_poa: 'Healthcare power of attorney',
  advance_directive: 'Advance healthcare directive',
  guardianship_plan: 'Guardianship plan',
  beneficiary_review: 'Beneficiary review',
  final_expense_plan: 'Final expense plan',
  business_succession: 'Business succession plan',
  buy_sell_agreement: 'Buy-sell agreement',
  key_person_planning: 'Key-person planning',
  digital_asset_plan: 'Digital asset plan',
  document_organization: 'Important-document organization',
  other: 'Other estate or legacy planning',
}

export const INSURANCE_EDUCATIONAL_DISCLOSURE =
  'Information collected here is for financial education and planning review. Coverage details should be confirmed against current policy documents.'

export const RETIREMENT_EDUCATIONAL_DISCLOSURE =
  'Retirement figures entered here are planning inputs for educational review. They are not guarantees, projections, or investment advice.'

export const ESTATE_LEGAL_DISCLOSURE =
  'Valtoris provides financial education and planning coordination, not legal advice. Estate documents and legal strategies should be reviewed with a qualified attorney.'

export function emptyOverviewAnswers(): OnboardingOverviewAnswers {
  return {
    maritalOrHouseholdStatus: '',
    dependentsCount: null,
    preferredContactMethod: '',
    advisorNotes: '',
    additionalContext: '',
  }
}

export function emptyMembersAnswers(): OnboardingMembersAnswers {
  return { advisorMemberNotes: '' }
}

export function emptyIncomeSource(partial?: Partial<OnboardingIncomeSource>): OnboardingIncomeSource {
  return {
    id: partial?.id ?? '',
    memberId: partial?.memberId ?? null,
    employerOrSourceName: partial?.employerOrSourceName ?? '',
    occupation: partial?.occupation ?? '',
    employmentStatus: partial?.employmentStatus ?? '',
    grossAnnualIncomeCents: partial?.grossAnnualIncomeCents ?? null,
    netMonthlyIncomeCents: partial?.netMonthlyIncomeCents ?? null,
    payFrequency: partial?.payFrequency ?? '',
    variableOrCommissionIncomeCents: partial?.variableOrCommissionIncomeCents ?? null,
    otherIncomeCents: partial?.otherIncomeCents ?? null,
    expectedIncomeChanges: partial?.expectedIncomeChanges ?? '',
    employerBenefitsNotes: partial?.employerBenefitsNotes ?? '',
    notes: partial?.notes ?? '',
  }
}

export function emptyIncomeAnswers(): OnboardingIncomeAnswers {
  return { noCurrentIncome: false, sources: [], notes: '' }
}

export function emptyCashFlowAnswers(): OnboardingCashFlowAnswers {
  return {
    takeHomeIncomeCents: null,
    housingCents: null,
    utilitiesCents: null,
    transportationCents: null,
    foodCents: null,
    childcareCents: null,
    insurancePremiumsCents: null,
    debtPaymentsCents: null,
    medicalCents: null,
    subscriptionsCents: null,
    discretionaryCents: null,
    otherFixedCents: null,
    otherVariableCents: null,
    unknownCategories: [],
    notes: '',
  }
}

export function emptyAssetItem(partial?: Partial<OnboardingAssetItem>): OnboardingAssetItem {
  return {
    id: partial?.id ?? '',
    category: partial?.category ?? '',
    description: partial?.description ?? '',
    balanceCents: partial?.balanceCents ?? null,
    ownership: partial?.ownership ?? '',
    liquidity: partial?.liquidity ?? '',
    valueStatus: partial?.valueStatus ?? 'estimated',
    notes: partial?.notes ?? '',
  }
}

export function emptyAssetsAnswers(): OnboardingAssetsAnswers {
  return { noAssets: false, items: [], notes: '' }
}

export function emptyDebtItem(partial?: Partial<OnboardingDebtItem>): OnboardingDebtItem {
  return {
    id: partial?.id ?? '',
    debtType: partial?.debtType ?? '',
    creditor: partial?.creditor ?? '',
    balanceCents: partial?.balanceCents ?? null,
    interestRatePercent: partial?.interestRatePercent ?? null,
    minimumPaymentCents: partial?.minimumPaymentCents ?? null,
    status: partial?.status ?? '',
    responsibleMemberId: partial?.responsibleMemberId ?? null,
    notes: partial?.notes ?? '',
  }
}

export function emptyDebtsAnswers(): OnboardingDebtsAnswers {
  return { noDebts: false, items: [], notes: '' }
}

export function emptyInsuranceCoverage(
  partial?: Partial<OnboardingInsuranceCoverage>,
): OnboardingInsuranceCoverage {
  return {
    id: partial?.id ?? '',
    coverageType: partial?.coverageType ?? '',
    carrierOrProvider: partial?.carrierOrProvider ?? '',
    insuredMemberId: partial?.insuredMemberId ?? null,
    policyOrPlanType: partial?.policyOrPlanType ?? '',
    coverageAmountCents: partial?.coverageAmountCents ?? null,
    premiumCents: partial?.premiumCents ?? null,
    premiumFrequency: partial?.premiumFrequency ?? '',
    employerProvided: partial?.employerProvided ?? false,
    personallyOwned: partial?.personallyOwned ?? false,
    beneficiaryReviewStatus: partial?.beneficiaryReviewStatus ?? '',
    expirationOrTerm: partial?.expirationOrTerm ?? '',
    clientReportedStatus: partial?.clientReportedStatus ?? '',
    advisorNotes: partial?.advisorNotes ?? '',
    knownConcerns: partial?.knownConcerns ?? '',
  }
}

export function emptyInsuranceAnswers(): OnboardingInsuranceAnswers {
  return {
    noCurrentCoverage: false,
    coverages: [],
    coverageReviewedRecently: '',
    beneficiariesReviewed: '',
    dependentsRelyOnIncome: '',
    existingProtectionConcerns: '',
    knownCoverageGaps: '',
    advisorObservedConcerns: '',
    clientStatedConcerns: '',
    protectionConcernsAcknowledged: false,
    notes: '',
  }
}

export function emptyRetirementAnswers(): OnboardingRetirementAnswers {
  return {
    planningStatus: '',
    desiredRetirementAge: null,
    desiredMonthlyIncomeCents: null,
    desiredIncomeUnknown: false,
    currentMonthlyContributionCents: null,
    contributionAcknowledged: false,
    employerMatchKind: '',
    employerMatchPercent: null,
    employerMatchAmountCents: null,
    pensionAvailable: '',
    pensionNotes: '',
    socialSecurityExpectation: '',
    retirementConfidence: '',
    primaryConcerns: '',
    expectedLifestyle: '',
    majorGoals: '',
    plannedLocation: '',
    otherAnticipatedIncome: '',
    advisorNotes: '',
  }
}

export function emptyEstatePlanningItem(
  key: EstatePlanningItemKey,
  partial?: Partial<OnboardingEstatePlanningItem>,
): OnboardingEstatePlanningItem {
  return {
    key,
    status: partial?.status ?? '',
    notes: partial?.notes ?? '',
  }
}

export function emptyEstateAnswers(): OnboardingEstateAnswers {
  return {
    items: ESTATE_PLANNING_ITEM_KEYS.map((key) => emptyEstatePlanningItem(key)),
    itemsAcknowledged: false,
    minorDependentsNeedGuardianship: '',
    legacyGoals: '',
    charitableGoals: '',
    familyTransferGoals: '',
    businessContinuityConcerns: '',
    finalExpenseConcerns: '',
    clientStatedConcerns: '',
    advisorObservedConcerns: '',
    lastReviewDate: null,
    estateAttorneyRelationship: '',
    advisorNotes: '',
  }
}

export function emptyImmediateConcern(
  partial?: Partial<OnboardingImmediateConcern>,
): OnboardingImmediateConcern {
  return {
    id: partial?.id ?? '',
    description: partial?.description ?? '',
    urgency: partial?.urgency ?? '',
    source: partial?.source ?? '',
    category: partial?.category ?? '',
    notes: partial?.notes ?? '',
  }
}

export function emptyPriorityItem(partial?: Partial<OnboardingPriorityItem>): OnboardingPriorityItem {
  return {
    id: partial?.id ?? '',
    rank: partial?.rank ?? null,
    title: partial?.title ?? '',
    description: partial?.description ?? '',
    timeHorizon: partial?.timeHorizon ?? '',
    category: partial?.category ?? '',
    source: partial?.source ?? '',
    targetAmountCents: partial?.targetAmountCents ?? null,
    targetDate: partial?.targetDate ?? null,
    status: partial?.status ?? '',
    notes: partial?.notes ?? '',
  }
}

export function emptyGoalsAnswers(): OnboardingGoalsAnswers {
  return {
    noCurrentGoals: false,
    immediateConcerns: [],
    priorities: [],
    majorUpcomingEvents: '',
    longTermVision: '',
    primaryMotivation: '',
    biggestObstacle: '',
    preferredPace: '',
    advisorSummary: '',
    clientAgreesWithPriorities: '',
  }
}
