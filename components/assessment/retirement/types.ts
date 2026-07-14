export type RetirementHouseholdAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string
  maritalStatus: string
  /** Explicit retirement status: 'yes' | 'no'. */
  alreadyRetired: string
  currentAge: string
  /**
   * Required when alreadyRetired is 'no'. Must be >= currentAge for validation.
   * Optional / informational when alreadyRetired is 'yes'.
   */
  targetRetirementAge: string
  /** Optional when maritalStatus is married; ignored otherwise. */
  spouseAge: string
  /** Optional when maritalStatus is married; ignored otherwise. */
  spouseTargetRetirementAge: string
}

export type RetirementVisionAnswers = {
  retirementLifestyle: string
  planClarity: string
  primaryMotivation: string
}

export type RetirementSavingsAnswers = {
  currentRetirementSavings: string
  monthlyContribution: string
  employerMatch: string
  contributionConsistency: string
}

/**
 * Income amounts are estimated monthly amounts expected at retirement (today's dollars
 * as entered by the user). Do not re-inflate these values in projections.
 */
export type RetirementIncomeSourceAnswers = {
  socialSecurityMonthly: string
  pensionMonthly: string
  annuityMonthly: string
  rentalIncomeMonthly: string
  businessIncomeMonthly: string
  otherRecurringIncomeMonthly: string
  /** Optional spouse Social Security when married. */
  spouseSocialSecurityMonthly: string
  socialSecurityEstimateReviewed: string
  pensionElectionUnderstood: string
  survivorContinuation: string
  /**
   * General inflation-awareness only (yes | no | unsure).
   * Does not model COLA growth in version one.
   */
  inflationAwareness: string
  expectsPartTimeWork: string
  estimatedMonthlyPartTimeIncome: string
  expectedPartTimeWorkYears: string
}

export type RetirementLifestyleAnswers = {
  currentAnnualGrossIncome: string
  /** Primary retirement spending input (monthly). */
  estimatedMonthlyRetirementSpending: string
  debtBurden: string
}

export type RetirementInvestmentAnswers = {
  riskTolerance: string
  diversification: string
  allocationReview: string
}

export type RetirementTaxAnswers = {
  accountTypes: string[]
  taxPlanning: string
  rothUsage: string
}

export type RetirementHealthcareAnswers = {
  medicareReadiness: string
  longTermCarePlan: string
  hsaBalance: string
}

export type RetirementEstateAnswers = {
  hasWill: string
  hasTrust: string
  beneficiariesReviewed: string
  hasPowerOfAttorney: string
  legacyIntent: string
}

export type RetirementGoalsAnswers = {
  selected: string[]
}

/** Contact preferences and consent — not used by scoring formulas. */
export type RetirementLeadDetails = {
  preferredContactMethod: string
  bestContactTime: string
  primaryConcern: string
  consentGiven: string
}

export type RetirementAssessmentAnswers = {
  household: RetirementHouseholdAnswers
  vision: RetirementVisionAnswers
  savings: RetirementSavingsAnswers
  incomeSources: RetirementIncomeSourceAnswers
  lifestyle: RetirementLifestyleAnswers
  investments: RetirementInvestmentAnswers
  tax: RetirementTaxAnswers
  healthcare: RetirementHealthcareAnswers
  estate: RetirementEstateAnswers
  goals: RetirementGoalsAnswers
  leadDetails: RetirementLeadDetails
}

export const INITIAL_RETIREMENT_ANSWERS: RetirementAssessmentAnswers = {
  household: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    state: '',
    maritalStatus: '',
    alreadyRetired: '',
    currentAge: '',
    targetRetirementAge: '',
    spouseAge: '',
    spouseTargetRetirementAge: '',
  },
  vision: {
    retirementLifestyle: '',
    planClarity: '',
    primaryMotivation: '',
  },
  savings: {
    currentRetirementSavings: '',
    monthlyContribution: '',
    employerMatch: '',
    contributionConsistency: '',
  },
  incomeSources: {
    socialSecurityMonthly: '',
    pensionMonthly: '',
    annuityMonthly: '',
    rentalIncomeMonthly: '',
    businessIncomeMonthly: '',
    otherRecurringIncomeMonthly: '',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: '',
    pensionElectionUnderstood: '',
    survivorContinuation: '',
    inflationAwareness: '',
    expectsPartTimeWork: '',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '',
    estimatedMonthlyRetirementSpending: '',
    debtBurden: '',
  },
  investments: {
    riskTolerance: '',
    diversification: '',
    allocationReview: '',
  },
  tax: {
    accountTypes: [],
    taxPlanning: '',
    rothUsage: '',
  },
  healthcare: {
    medicareReadiness: '',
    longTermCarePlan: '',
    hsaBalance: '',
  },
  estate: {
    hasWill: '',
    hasTrust: '',
    beneficiariesReviewed: '',
    hasPowerOfAttorney: '',
    legacyIntent: '',
  },
  goals: {
    selected: [],
  },
  leadDetails: {
    preferredContactMethod: '',
    bestContactTime: '',
    primaryConcern: '',
    consentGiven: '',
  },
}

function allFilled(values: Record<string, string>) {
  return Object.values(values).every((value) => value.trim() !== '')
}

function parseAgeValue(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return NaN
  return parsed
}

export function isMarried(household: RetirementHouseholdAnswers) {
  return household.maritalStatus === 'married'
}

export function isAlreadyRetiredAnswer(household: RetirementHouseholdAnswers) {
  return household.alreadyRetired === 'yes'
}

/**
 * When not already retired, target retirement age must be present and >= current age.
 * Invalid ages fail validation rather than silently becoming an already-retired profile.
 */
export function isRetirementAgeValid(household: RetirementHouseholdAnswers) {
  if (isAlreadyRetiredAnswer(household)) {
    return household.currentAge.trim() !== '' && Number.isFinite(parseAgeValue(household.currentAge))
  }

  const currentAge = parseAgeValue(household.currentAge)
  const retirementAge = parseAgeValue(household.targetRetirementAge)
  if (!Number.isFinite(currentAge) || !Number.isFinite(retirementAge)) return false
  if (household.currentAge.trim() === '' || household.targetRetirementAge.trim() === '') return false
  return retirementAge >= currentAge
}

/** Timeline / household step — excludes contact fields collected on the final step. */
export function isHouseholdTimelineComplete(household: RetirementHouseholdAnswers) {
  const base = {
    state: household.state,
    maritalStatus: household.maritalStatus,
    alreadyRetired: household.alreadyRetired,
    currentAge: household.currentAge,
  }

  if (!allFilled(base)) return false
  if (!isAlreadyRetiredAnswer(household) && household.targetRetirementAge.trim() === '') return false
  return isRetirementAgeValid(household)
}

export function isContactComplete(
  household: RetirementHouseholdAnswers,
  leadDetails: RetirementLeadDetails,
) {
  const contact = {
    firstName: household.firstName,
    lastName: household.lastName,
    email: household.email,
    phone: household.phone,
  }
  if (!allFilled(contact)) return false
  if (leadDetails.consentGiven !== 'yes') return false
  return (
    leadDetails.preferredContactMethod.trim() !== '' && leadDetails.bestContactTime.trim() !== ''
  )
}

/** @deprecated Prefer isHouseholdTimelineComplete + isContactComplete for the 9-step flow. */
export function isHouseholdComplete(household: RetirementHouseholdAnswers) {
  const base = {
    firstName: household.firstName,
    lastName: household.lastName,
    email: household.email,
    phone: household.phone,
    state: household.state,
    maritalStatus: household.maritalStatus,
    alreadyRetired: household.alreadyRetired,
    currentAge: household.currentAge,
  }

  if (!allFilled(base)) return false
  if (!isAlreadyRetiredAnswer(household) && household.targetRetirementAge.trim() === '') return false
  return isRetirementAgeValid(household)
}

export function isVisionComplete(vision: RetirementVisionAnswers) {
  return allFilled(vision)
}

export function isSavingsComplete(savings: RetirementSavingsAnswers) {
  return allFilled(savings)
}

export function isIncomeSourcesComplete(incomeSources: RetirementIncomeSourceAnswers) {
  const baseComplete =
    incomeSources.socialSecurityMonthly.trim() !== '' &&
    incomeSources.pensionMonthly.trim() !== '' &&
    incomeSources.annuityMonthly.trim() !== '' &&
    incomeSources.rentalIncomeMonthly.trim() !== '' &&
    incomeSources.businessIncomeMonthly.trim() !== '' &&
    incomeSources.otherRecurringIncomeMonthly.trim() !== '' &&
    incomeSources.socialSecurityEstimateReviewed.trim() !== '' &&
    incomeSources.pensionElectionUnderstood.trim() !== '' &&
    incomeSources.survivorContinuation.trim() !== '' &&
    incomeSources.expectsPartTimeWork.trim() !== ''

  if (!baseComplete) return false

  if (incomeSources.expectsPartTimeWork !== 'yes') return true

  return (
    incomeSources.estimatedMonthlyPartTimeIncome.trim() !== '' &&
    incomeSources.expectedPartTimeWorkYears.trim() !== ''
  )
}

export function isLifestyleComplete(lifestyle: RetirementLifestyleAnswers) {
  return (
    lifestyle.currentAnnualGrossIncome.trim() !== '' &&
    lifestyle.debtBurden.trim() !== ''
    // estimatedMonthlyRetirementSpending may be blank to trigger 80% income fallback
  )
}

export function isInvestmentsComplete(investments: RetirementInvestmentAnswers) {
  return allFilled(investments)
}

export function isTaxComplete(tax: RetirementTaxAnswers) {
  return tax.accountTypes.length > 0 && tax.taxPlanning.trim() !== '' && tax.rothUsage.trim() !== ''
}

export function isHealthcareComplete(healthcare: RetirementHealthcareAnswers) {
  return allFilled(healthcare)
}

export function isEstateComplete(estate: RetirementEstateAnswers) {
  return allFilled(estate)
}

export function isRetirementGoalsComplete(goals: RetirementGoalsAnswers) {
  return goals.selected.length > 0
}

export function isInflationAwarenessComplete(incomeSources: RetirementIncomeSourceAnswers) {
  return incomeSources.inflationAwareness.trim() !== ''
}

/** Nine-step assessment UI validators (welcome = 1). */
export function isRetirementStepComplete(step: number, answers: RetirementAssessmentAnswers) {
  switch (step) {
    case 1:
      return true
    case 2:
      return (
        isHouseholdTimelineComplete(answers.household) && isVisionComplete(answers.vision)
      )
    case 3:
      return isLifestyleComplete(answers.lifestyle)
    case 4:
      return isSavingsComplete(answers.savings)
    case 5:
      return isIncomeSourcesComplete(answers.incomeSources)
    case 6:
      return (
        isRetirementGoalsComplete(answers.goals) &&
        isInflationAwarenessComplete(answers.incomeSources)
      )
    case 7:
      return isInvestmentsComplete(answers.investments) && isTaxComplete(answers.tax)
    case 8:
      return isHealthcareComplete(answers.healthcare) && isEstateComplete(answers.estate)
    case 9:
      return isContactComplete(answers.household, answers.leadDetails)
    default:
      return false
  }
}
