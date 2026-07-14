import { describe, expect, it } from 'vitest'
import {
  INITIAL_RETIREMENT_ANSWERS,
  RetirementAssessmentAnswers,
  isHouseholdComplete,
  isRetirementAgeValid,
} from '../retirement/types'
import {
  calculateRetirementProjections,
  futureValueWithContributions,
  scoreRetirementAssessment,
  scoreToRetirementLevel,
  scoreToRetirementStatus,
} from './scoreRetirementAssessment'

function buildAnswers(
  overrides: Partial<{
    household: Partial<RetirementAssessmentAnswers['household']>
    vision: Partial<RetirementAssessmentAnswers['vision']>
    savings: Partial<RetirementAssessmentAnswers['savings']>
    incomeSources: Partial<RetirementAssessmentAnswers['incomeSources']>
    lifestyle: Partial<RetirementAssessmentAnswers['lifestyle']>
    investments: Partial<RetirementAssessmentAnswers['investments']>
    tax: Partial<RetirementAssessmentAnswers['tax']>
    healthcare: Partial<RetirementAssessmentAnswers['healthcare']>
    estate: Partial<RetirementAssessmentAnswers['estate']>
    goals: Partial<RetirementAssessmentAnswers['goals']>
    leadDetails: Partial<RetirementAssessmentAnswers['leadDetails']>
  }>,
): RetirementAssessmentAnswers {
  return {
    household: { ...INITIAL_RETIREMENT_ANSWERS.household, ...overrides.household },
    vision: { ...INITIAL_RETIREMENT_ANSWERS.vision, ...overrides.vision },
    savings: { ...INITIAL_RETIREMENT_ANSWERS.savings, ...overrides.savings },
    incomeSources: {
      ...INITIAL_RETIREMENT_ANSWERS.incomeSources,
      ...overrides.incomeSources,
    },
    lifestyle: { ...INITIAL_RETIREMENT_ANSWERS.lifestyle, ...overrides.lifestyle },
    investments: { ...INITIAL_RETIREMENT_ANSWERS.investments, ...overrides.investments },
    tax: {
      ...INITIAL_RETIREMENT_ANSWERS.tax,
      ...overrides.tax,
      accountTypes: overrides.tax?.accountTypes ?? INITIAL_RETIREMENT_ANSWERS.tax.accountTypes,
    },
    healthcare: { ...INITIAL_RETIREMENT_ANSWERS.healthcare, ...overrides.healthcare },
    estate: { ...INITIAL_RETIREMENT_ANSWERS.estate, ...overrides.estate },
    goals: {
      ...INITIAL_RETIREMENT_ANSWERS.goals,
      ...overrides.goals,
      selected: overrides.goals?.selected ?? INITIAL_RETIREMENT_ANSWERS.goals.selected,
    },
    leadDetails: {
      ...INITIAL_RETIREMENT_ANSWERS.leadDetails,
      ...overrides.leadDetails,
    },
  }
}

function assertFiniteMetrics(result: ReturnType<typeof scoreRetirementAssessment>) {
  const { metrics } = result
  const numericValues = [
    result.overallScore,
    metrics.yearsUntilRetirement,
    metrics.yearsInRetirement,
    metrics.projectedNestEgg,
    metrics.requiredNestEgg,
    metrics.nestEggGap,
    metrics.targetAnnualRetirementSpending,
    metrics.totalGuaranteedMonthlyIncome,
    metrics.totalOtherExpectedMonthlyIncome,
    metrics.totalProjectedMonthlyIncome,
    metrics.guaranteedCoveragePercent,
    metrics.expectedIncomeCoveragePercent,
    metrics.annualIncomeGap,
    metrics.incomeReplacementRatio,
  ]

  for (const value of numericValues) {
    expect(Number.isFinite(value)).toBe(true)
    expect(value).not.toBe(Number.POSITIVE_INFINITY)
    expect(value).not.toBe(Number.NEGATIVE_INFINITY)
  }

  expect(metrics.yearsUntilRetirement).toBeGreaterThanOrEqual(0)
  expect(metrics.guaranteedCoveragePercent).toBeGreaterThanOrEqual(0)
  expect(metrics.guaranteedCoveragePercent).toBeLessThanOrEqual(1)
}

const BASE_STRONG_INCOME = {
  socialSecurityMonthly: '3000',
  pensionMonthly: '1500',
  annuityMonthly: '500',
  rentalIncomeMonthly: '1000',
  businessIncomeMonthly: '0',
  otherRecurringIncomeMonthly: '0',
  spouseSocialSecurityMonthly: '2000',
  socialSecurityEstimateReviewed: 'yes',
  pensionElectionUnderstood: 'yes',
  survivorContinuation: 'yes',
  inflationAwareness: 'yes',
  expectsPartTimeWork: 'no',
  estimatedMonthlyPartTimeIncome: '',
  expectedPartTimeWorkYears: '',
}

/** 1. Strongly prepared household */
export const STRONG_RETIREMENT_PROFILE = buildAnswers({
  household: {
    firstName: 'Strong',
    lastName: 'Saver',
    email: 'strong@example.com',
    phone: '5551110001',
    state: 'TX',
    maritalStatus: 'married',
    alreadyRetired: 'no',
    currentAge: '55',
    targetRetirementAge: '65',
    spouseAge: '53',
    spouseTargetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'very-clear',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '1200000',
    monthlyContribution: '2500',
    employerMatch: 'full-match',
    contributionConsistency: 'always',
  },
  incomeSources: BASE_STRONG_INCOME,
  lifestyle: {
    currentAnnualGrossIncome: '220000',
    estimatedMonthlyRetirementSpending: '7500',
    debtBurden: 'none',
  },
  investments: {
    riskTolerance: 'moderate',
    diversification: 'well-diversified',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth', 'taxable', 'hsa'],
    taxPlanning: 'proactive',
    rothUsage: 'regular',
  },
  healthcare: {
    medicareReadiness: 'researched',
    longTermCarePlan: 'has-coverage',
    hsaBalance: '35000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'yes',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'yes',
    legacyIntent: 'strong',
  },
  goals: {
    selected: ['protect-legacy', 'maximize-income-sources'],
  },
})

/** 2. Moderately prepared household */
export const MODERATE_RETIREMENT_PROFILE = buildAnswers({
  household: {
    firstName: 'Moderate',
    lastName: 'Planner',
    email: 'moderate@example.com',
    phone: '5551110002',
    state: 'CA',
    maritalStatus: 'married',
    alreadyRetired: 'no',
    currentAge: '48',
    targetRetirementAge: '67',
    spouseAge: '46',
    spouseTargetRetirementAge: '67',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'leave-workforce',
  },
  savings: {
    currentRetirementSavings: '320000',
    monthlyContribution: '900',
    employerMatch: 'partial-match',
    contributionConsistency: 'most-months',
  },
  incomeSources: {
    socialSecurityMonthly: '2300',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '1500',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'unsure',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '150000',
    estimatedMonthlyRetirementSpending: '6500',
    debtBurden: 'low',
  },
  investments: {
    riskTolerance: 'growth',
    diversification: 'somewhat',
    allocationReview: '1-3-years',
  },
  tax: {
    accountTypes: ['traditional', 'roth'],
    taxPlanning: 'annual-review',
    rothUsage: 'some',
  },
  healthcare: {
    medicareReadiness: 'somewhat',
    longTermCarePlan: 'self-fund',
    hsaBalance: '8000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'moderate',
  },
  goals: {
    selected: ['increase-savings', 'close-income-gap'],
  },
})

/** 3. Significant income gap */
export const INCOME_GAP_RETIREMENT_PROFILE = buildAnswers({
  household: {
    firstName: 'Gap',
    lastName: 'Household',
    email: 'gap@example.com',
    phone: '5551110003',
    state: 'FL',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '58',
    targetRetirementAge: '62',
  },
  vision: {
    retirementLifestyle: 'affluent',
    planClarity: 'unclear',
    primaryMotivation: 'travel-lifestyle',
  },
  savings: {
    currentRetirementSavings: '85000',
    monthlyContribution: '200',
    employerMatch: 'not-participating',
    contributionConsistency: 'rarely',
  },
  incomeSources: {
    socialSecurityMonthly: '1500',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'no',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'no',
    inflationAwareness: 'no',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '95000',
    estimatedMonthlyRetirementSpending: '7500',
    debtBurden: 'high',
  },
  investments: {
    riskTolerance: 'aggressive',
    diversification: 'concentrated',
    allocationReview: 'never',
  },
  tax: {
    accountTypes: ['traditional'],
    taxPlanning: 'none',
    rothUsage: 'none',
  },
  healthcare: {
    medicareReadiness: 'not-yet',
    longTermCarePlan: 'no-plan',
    hsaBalance: '0',
  },
  estate: {
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'no',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'unsure',
  },
  goals: {
    selected: ['close-income-gap', 'increase-savings'],
  },
})

/** 4. Already-retired household */
export const ALREADY_RETIRED_PROFILE = buildAnswers({
  household: {
    firstName: 'Retired',
    lastName: 'Couple',
    email: 'retired@example.com',
    phone: '5551110004',
    state: 'AZ',
    maritalStatus: 'married',
    alreadyRetired: 'yes',
    currentAge: '70',
    targetRetirementAge: '65',
    spouseAge: '68',
    spouseTargetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'very-clear',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '900000',
    monthlyContribution: '0',
    employerMatch: 'no-match-offered',
    contributionConsistency: 'not-saving',
  },
  incomeSources: {
    socialSecurityMonthly: '2700',
    pensionMonthly: '2000',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '1800',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'yes',
    survivorContinuation: 'yes',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'yes',
    estimatedMonthlyPartTimeIncome: '800',
    expectedPartTimeWorkYears: '3',
  },
  lifestyle: {
    currentAnnualGrossIncome: '78000',
    estimatedMonthlyRetirementSpending: '6000',
    debtBurden: 'none',
  },
  investments: {
    riskTolerance: 'conservative',
    diversification: 'well-diversified',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth', 'taxable'],
    taxPlanning: 'proactive',
    rothUsage: 'some',
  },
  healthcare: {
    medicareReadiness: 'already-enrolled',
    longTermCarePlan: 'has-coverage',
    hsaBalance: '12000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'yes',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'yes',
    legacyIntent: 'moderate',
  },
  goals: {
    selected: ['protect-legacy', 'plan-healthcare'],
  },
})

/** 5. Young household far from retirement */
export const YOUNG_FAR_FROM_RETIREMENT_PROFILE = buildAnswers({
  household: {
    firstName: 'Young',
    lastName: 'Starter',
    email: 'young@example.com',
    phone: '5551110005',
    state: 'NY',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '28',
    targetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'reduce-stress',
  },
  savings: {
    currentRetirementSavings: '25000',
    monthlyContribution: '500',
    employerMatch: 'full-match',
    contributionConsistency: 'always',
  },
  incomeSources: {
    socialSecurityMonthly: '0',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'unsure',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'na',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '85000',
    estimatedMonthlyRetirementSpending: '4000',
    debtBurden: 'moderate',
  },
  investments: {
    riskTolerance: 'growth',
    diversification: 'somewhat',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth'],
    taxPlanning: 'annual-review',
    rothUsage: 'regular',
  },
  healthcare: {
    medicareReadiness: 'years-away',
    longTermCarePlan: 'no-plan',
    hsaBalance: '1500',
  },
  estate: {
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'unsure',
  },
  goals: {
    selected: ['increase-savings', 'clarify-timeline'],
  },
})

/** 6. Zero savings */
export const ZERO_SAVINGS_PROFILE = buildAnswers({
  household: {
    firstName: 'Zero',
    lastName: 'Savings',
    email: 'zero@example.com',
    phone: '5551110006',
    state: 'OH',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '40',
    targetRetirementAge: '67',
  },
  vision: {
    retirementLifestyle: 'essential',
    planClarity: 'no-plan',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '0',
    monthlyContribution: '0',
    employerMatch: 'not-participating',
    contributionConsistency: 'not-saving',
  },
  incomeSources: {
    socialSecurityMonthly: '1600',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'no',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'no',
    inflationAwareness: 'unsure',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '70000',
    estimatedMonthlyRetirementSpending: '3500',
    debtBurden: 'moderate',
  },
  investments: {
    riskTolerance: 'unsure',
    diversification: 'unsure',
    allocationReview: 'never',
  },
  tax: {
    accountTypes: ['none'],
    taxPlanning: 'none',
    rothUsage: 'none',
  },
  healthcare: {
    medicareReadiness: 'years-away',
    longTermCarePlan: 'no-plan',
    hsaBalance: '0',
  },
  estate: {
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'no',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'unsure',
  },
  goals: {
    selected: ['increase-savings', 'close-income-gap'],
  },
})

/** 7. Missing optional spouse data */
export const MISSING_SPOUSE_DATA_PROFILE = buildAnswers({
  household: {
    firstName: 'Married',
    lastName: 'NoSpouseData',
    email: 'spouse-missing@example.com',
    phone: '5551110007',
    state: 'WA',
    maritalStatus: 'married',
    alreadyRetired: 'no',
    currentAge: '50',
    targetRetirementAge: '66',
    spouseAge: '',
    spouseTargetRetirementAge: '',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'family-legacy',
  },
  savings: {
    currentRetirementSavings: '410000',
    monthlyContribution: '1100',
    employerMatch: 'full-match',
    contributionConsistency: 'always',
  },
  incomeSources: {
    socialSecurityMonthly: '2500',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'unsure',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '160000',
    estimatedMonthlyRetirementSpending: '7000',
    debtBurden: 'low',
  },
  investments: {
    riskTolerance: 'moderate',
    diversification: 'well-diversified',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth', 'taxable'],
    taxPlanning: 'annual-review',
    rothUsage: 'some',
  },
  healthcare: {
    medicareReadiness: 'somewhat',
    longTermCarePlan: 'self-fund',
    hsaBalance: '9000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'yes',
    legacyIntent: 'moderate',
  },
  goals: {
    selected: ['maximize-income-sources', 'protect-legacy'],
  },
})

/** 8. Invalid retirement age (for validation tests; not scored as already retired) */
export const INVALID_RETIREMENT_AGE_PROFILE = buildAnswers({
  household: {
    firstName: 'Invalid',
    lastName: 'Age',
    email: 'invalid-age@example.com',
    phone: '5551110008',
    state: 'CO',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '68',
    targetRetirementAge: '62',
  },
  vision: {
    retirementLifestyle: 'essential',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '450000',
    monthlyContribution: '0',
    employerMatch: 'no-match-offered',
    contributionConsistency: 'not-saving',
  },
  incomeSources: {
    socialSecurityMonthly: '2200',
    pensionMonthly: '700',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'yes',
    survivorContinuation: 'no',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '50000',
    estimatedMonthlyRetirementSpending: '4000',
    debtBurden: 'low',
  },
  investments: {
    riskTolerance: 'conservative',
    diversification: 'somewhat',
    allocationReview: '1-3-years',
  },
  tax: {
    accountTypes: ['traditional', 'taxable'],
    taxPlanning: 'compliance-only',
    rothUsage: 'none',
  },
  healthcare: {
    medicareReadiness: 'already-enrolled',
    longTermCarePlan: 'family-support',
    hsaBalance: '0',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'spend-down',
  },
  goals: {
    selected: ['plan-healthcare', 'close-income-gap'],
  },
})

/** 9. Zero income / zero spending */
export const ZERO_INCOME_EXPENSES_PROFILE = buildAnswers({
  household: {
    firstName: 'Zero',
    lastName: 'Cashflow',
    email: 'zero-cash@example.com',
    phone: '5551110009',
    state: 'IL',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '45',
    targetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'essential',
    planClarity: 'unclear',
    primaryMotivation: 'reduce-stress',
  },
  savings: {
    currentRetirementSavings: '100000',
    monthlyContribution: '250',
    employerMatch: 'self-employed',
    contributionConsistency: 'sometimes',
  },
  incomeSources: {
    socialSecurityMonthly: '0',
    pensionMonthly: '0',
    annuityMonthly: '0',
    rentalIncomeMonthly: '0',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'unsure',
    pensionElectionUnderstood: 'na',
    survivorContinuation: 'na',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '0',
    estimatedMonthlyRetirementSpending: '0',
    debtBurden: 'none',
  },
  investments: {
    riskTolerance: 'moderate',
    diversification: 'somewhat',
    allocationReview: 'unsure',
  },
  tax: {
    accountTypes: ['traditional'],
    taxPlanning: 'compliance-only',
    rothUsage: 'unsure',
  },
  healthcare: {
    medicareReadiness: 'years-away',
    longTermCarePlan: 'unsure',
    hsaBalance: '0',
  },
  estate: {
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'unsure',
  },
  goals: {
    selected: ['clarify-timeline'],
  },
})

/** 10. Extreme but valid values */
export const EXTREME_VALID_PROFILE = buildAnswers({
  household: {
    firstName: 'Extreme',
    lastName: 'Values',
    email: 'extreme@example.com',
    phone: '5551110010',
    state: 'NV',
    maritalStatus: 'married',
    alreadyRetired: 'no',
    currentAge: '35',
    targetRetirementAge: '50',
    spouseAge: '34',
    spouseTargetRetirementAge: '50',
  },
  vision: {
    retirementLifestyle: 'luxury',
    planClarity: 'very-clear',
    primaryMotivation: 'travel-lifestyle',
  },
  savings: {
    currentRetirementSavings: '8500000',
    monthlyContribution: '25000',
    employerMatch: 'full-match',
    contributionConsistency: 'always',
  },
  incomeSources: {
    socialSecurityMonthly: '4000',
    pensionMonthly: '8000',
    annuityMonthly: '5000',
    rentalIncomeMonthly: '12000',
    businessIncomeMonthly: '10000',
    otherRecurringIncomeMonthly: '2000',
    spouseSocialSecurityMonthly: '3500',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'yes',
    survivorContinuation: 'yes',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '2500000',
    estimatedMonthlyRetirementSpending: '50000',
    debtBurden: 'none',
  },
  investments: {
    riskTolerance: 'aggressive',
    diversification: 'well-diversified',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth', 'taxable', 'hsa', 'pension', 'annuity'],
    taxPlanning: 'proactive',
    rothUsage: 'regular',
  },
  healthcare: {
    medicareReadiness: 'years-away',
    longTermCarePlan: 'has-coverage',
    hsaBalance: '250000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'yes',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'yes',
    legacyIntent: 'strong',
  },
  goals: {
    selected: ['protect-legacy', 'diversify-taxes'],
  },
})

/** Many tiny income sources that should not score artificially strong. */
export const LOW_DOLLAR_MULTI_SOURCE_PROFILE = buildAnswers({
  household: {
    firstName: 'Many',
    lastName: 'TinySources',
    email: 'tiny@example.com',
    phone: '5551110011',
    state: 'GA',
    maritalStatus: 'single',
    alreadyRetired: 'no',
    currentAge: '55',
    targetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '40000',
    monthlyContribution: '100',
    employerMatch: 'partial-match',
    contributionConsistency: 'sometimes',
  },
  incomeSources: {
    socialSecurityMonthly: '50',
    pensionMonthly: '40',
    annuityMonthly: '30',
    rentalIncomeMonthly: '25',
    businessIncomeMonthly: '20',
    otherRecurringIncomeMonthly: '15',
    spouseSocialSecurityMonthly: '',
    socialSecurityEstimateReviewed: 'no',
    pensionElectionUnderstood: 'no',
    survivorContinuation: 'no',
    inflationAwareness: 'unsure',
    expectsPartTimeWork: 'yes',
    estimatedMonthlyPartTimeIncome: '10',
    expectedPartTimeWorkYears: '2',
  },
  lifestyle: {
    currentAnnualGrossIncome: '90000',
    estimatedMonthlyRetirementSpending: '6000',
    debtBurden: 'moderate',
  },
  investments: {
    riskTolerance: 'unsure',
    diversification: 'concentrated',
    allocationReview: 'never',
  },
  tax: {
    accountTypes: ['traditional'],
    taxPlanning: 'none',
    rothUsage: 'none',
  },
  healthcare: {
    medicareReadiness: 'not-yet',
    longTermCarePlan: 'no-plan',
    hsaBalance: '0',
  },
  estate: {
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'no',
    hasPowerOfAttorney: 'no',
    legacyIntent: 'unsure',
  },
  goals: {
    selected: ['close-income-gap'],
  },
})

describe('futureValueWithContributions', () => {
  it('handles zero years, zero rate, and zero values safely', () => {
    expect(futureValueWithContributions(100000, 12000, 0.06, 0)).toBe(100000)
    expect(futureValueWithContributions(100000, 12000, 0, 10)).toBe(220000)
    expect(futureValueWithContributions(0, 0, 0.06, 20)).toBe(0)
    expect(futureValueWithContributions(-5, -10, Number.NaN, -3)).toBe(0)
  })
})

describe('retirement status and readiness labels', () => {
  it('maps four category statuses', () => {
    expect(scoreToRetirementStatus(95)).toBe('strong')
    expect(scoreToRetirementStatus(80)).toBe('strong')
    expect(scoreToRetirementStatus(79)).toBe('stable')
    expect(scoreToRetirementStatus(65)).toBe('stable')
    expect(scoreToRetirementStatus(64)).toBe('needs-attention')
    expect(scoreToRetirementStatus(45)).toBe('needs-attention')
    expect(scoreToRetirementStatus(44)).toBe('priority-risk')
    expect(scoreToRetirementStatus(0)).toBe('priority-risk')
  })

  it('maps educational readiness labels without branded Ready™ language', () => {
    expect(scoreToRetirementLevel(95)).toBe('Strong Retirement Foundation')
    expect(scoreToRetirementLevel(85)).toBe('Generally On Track')
    expect(scoreToRetirementLevel(75)).toBe('Important Gaps to Address')
    expect(scoreToRetirementLevel(65)).toBe('Significant Retirement Risks')
    expect(scoreToRetirementLevel(40)).toBe('Immediate Planning Priorities')
    expect(scoreToRetirementLevel(90)).not.toContain('™')
  })
})

describe('inflation awareness scoring', () => {
  it('scores Yes higher than Not sure and No for income-sources reliability', () => {
    const yes = scoreRetirementAssessment(
      buildAnswers({
        ...STRONG_RETIREMENT_PROFILE,
        incomeSources: { ...STRONG_RETIREMENT_PROFILE.incomeSources, inflationAwareness: 'yes' },
      }),
    )
    const unsure = scoreRetirementAssessment(
      buildAnswers({
        ...STRONG_RETIREMENT_PROFILE,
        incomeSources: { ...STRONG_RETIREMENT_PROFILE.incomeSources, inflationAwareness: 'unsure' },
      }),
    )
    const no = scoreRetirementAssessment(
      buildAnswers({
        ...STRONG_RETIREMENT_PROFILE,
        incomeSources: { ...STRONG_RETIREMENT_PROFILE.incomeSources, inflationAwareness: 'no' },
      }),
    )

    const yesIncome = yes.categories.find((c) => c.id === 'income-sources')!.score
    const unsureIncome = unsure.categories.find((c) => c.id === 'income-sources')!.score
    const noIncome = no.categories.find((c) => c.id === 'income-sources')!.score

    expect(yesIncome).toBeGreaterThan(unsureIncome)
    expect(unsureIncome).toBeGreaterThan(noIncome)
  })

  it('handles a missing optional inflation-awareness value safely without NaN', () => {
    const result = scoreRetirementAssessment(
      buildAnswers({
        ...MODERATE_RETIREMENT_PROFILE,
        incomeSources: { ...MODERATE_RETIREMENT_PROFILE.incomeSources, inflationAwareness: '' },
      }),
    )
    assertFiniteMetrics(result)
    const incomeSources = result.categories.find((c) => c.id === 'income-sources')!
    expect(Number.isFinite(incomeSources.score)).toBe(true)
  })
})

describe('spending and income projection corrections', () => {
  it('uses stated monthly retirement spending instead of the 80% fallback', () => {
    const metrics = calculateRetirementProjections(STRONG_RETIREMENT_PROFILE)
    expect(metrics.usedSpendingFallback).toBe(false)
    expect(metrics.annualRetirementSpendingToday).toBe(7500 * 12)
    expect(metrics.targetAnnualRetirementSpending).toBeGreaterThan(metrics.annualRetirementSpendingToday)
  })

  it('falls back to 80% of gross income when monthly spending is missing', () => {
    const answers = buildAnswers({
      household: STRONG_RETIREMENT_PROFILE.household,
      vision: STRONG_RETIREMENT_PROFILE.vision,
      savings: STRONG_RETIREMENT_PROFILE.savings,
      incomeSources: STRONG_RETIREMENT_PROFILE.incomeSources,
      lifestyle: {
        currentAnnualGrossIncome: '100000',
        estimatedMonthlyRetirementSpending: '',
        debtBurden: 'none',
      },
      investments: STRONG_RETIREMENT_PROFILE.investments,
      tax: STRONG_RETIREMENT_PROFILE.tax,
      healthcare: STRONG_RETIREMENT_PROFILE.healthcare,
      estate: STRONG_RETIREMENT_PROFILE.estate,
      goals: STRONG_RETIREMENT_PROFILE.goals,
    })

    const metrics = calculateRetirementProjections(answers)
    expect(metrics.usedSpendingFallback).toBe(true)
    expect(metrics.annualRetirementSpendingToday).toBe(80000)
  })

  it('does not double-inflate entered retirement income amounts', () => {
    const metrics = calculateRetirementProjections(STRONG_RETIREMENT_PROFILE)
    // 3000 + 2000 spouse SS + 1500 pension + 500 annuity = 7000 guaranteed
    expect(metrics.totalGuaranteedMonthlyIncome).toBe(7000)
    expect(metrics.totalOtherExpectedMonthlyIncome).toBe(1000)
    expect(metrics.yearsUntilRetirement).toBe(10)
    // If income were inflated for 10 years at 3%, guaranteed would be far above 7000.
    expect(metrics.totalGuaranteedMonthlyIncome).toBeLessThan(8000)
  })

  it('separates guaranteed versus other expected income and coverage percents', () => {
    const metrics = calculateRetirementProjections(STRONG_RETIREMENT_PROFILE)
    expect(metrics.socialSecurityMonthly).toBe(5000)
    expect(metrics.pensionMonthly).toBe(1500)
    expect(metrics.annuityMonthly).toBe(500)
    expect(metrics.rentalIncomeMonthly).toBe(1000)
    expect(metrics.totalGuaranteedMonthlyIncome).toBe(7000)
    expect(metrics.totalOtherExpectedMonthlyIncome).toBe(1000)
    expect(metrics.totalExpectedMonthlyIncomeBeforePortfolio).toBe(8000)
    expect(metrics.guaranteedCoveragePercent).toBeGreaterThan(0)
    expect(metrics.expectedIncomeCoveragePercent).toBeGreaterThanOrEqual(metrics.guaranteedCoveragePercent)
  })

  it('includes temporary part-time income only when expectsPartTimeWork is yes', () => {
    const withPartTime = calculateRetirementProjections(ALREADY_RETIRED_PROFILE)
    expect(withPartTime.partTimeIncomeIncluded).toBe(true)
    expect(withPartTime.partTimeIsTemporary).toBe(true)
    expect(withPartTime.partTimeIncomeMonthly).toBe(800)
    expect(withPartTime.expectedPartTimeWorkYears).toBe(3)
    expect(withPartTime.totalOtherExpectedMonthlyIncome).toBe(
      withPartTime.totalOtherExpectedMonthlyIncomeExcludingPartTime + 800,
    )

    const without = calculateRetirementProjections(STRONG_RETIREMENT_PROFILE)
    expect(without.partTimeIncomeIncluded).toBe(false)
    expect(without.partTimeIncomeMonthly).toBe(0)
  })

  it('handles already-retired calculation without contribution growth years', () => {
    const metrics = calculateRetirementProjections(ALREADY_RETIRED_PROFILE)
    expect(metrics.isAlreadyRetired).toBe(true)
    expect(metrics.yearsUntilRetirement).toBe(0)
    expect(metrics.projectedNestEgg).toBe(900000)
    expect(metrics.targetAnnualRetirementSpending).toBe(6000 * 12)
    expect(metrics.annualRetirementSpendingToday).toBe(metrics.targetAnnualRetirementSpending)
  })

  it('handles zero target spending safely', () => {
    const metrics = calculateRetirementProjections(ZERO_INCOME_EXPENSES_PROFILE)
    expect(metrics.targetAnnualRetirementSpending).toBe(0)
    expect(metrics.annualIncomeGap).toBe(0)
    expect(metrics.incomeReplacementRatio).toBe(1)
    expect(Number.isFinite(metrics.guaranteedCoveragePercent)).toBe(true)
  })
})

describe('validation', () => {
  it('fails household validation when retirement age is below current age and not already retired', () => {
    expect(isRetirementAgeValid(INVALID_RETIREMENT_AGE_PROFILE.household)).toBe(false)
    expect(isHouseholdComplete(INVALID_RETIREMENT_AGE_PROFILE.household)).toBe(false)
  })

  it('accepts already-retired households even when target age is below current age', () => {
    expect(isRetirementAgeValid(ALREADY_RETIRED_PROFILE.household)).toBe(true)
    expect(isHouseholdComplete(ALREADY_RETIRED_PROFILE.household)).toBe(true)
  })
})

describe('scoreRetirementAssessment profiles', () => {
  it('1. scores a strongly prepared household highly', () => {
    const result = scoreRetirementAssessment(STRONG_RETIREMENT_PROFILE)
    assertFiniteMetrics(result)
    expect(result.categories).toHaveLength(8)
    expect(result.overallScore).toBeGreaterThan(80)
    expect(result.currentLevel).not.toContain('™')
    expect(result.categories.every((c) =>
      ['strong', 'stable', 'needs-attention', 'priority-risk'].includes(c.status),
    )).toBe(true)
  })

  it('2. scores a moderately prepared household between gap and strong', () => {
    const strong = scoreRetirementAssessment(STRONG_RETIREMENT_PROFILE)
    const moderate = scoreRetirementAssessment(MODERATE_RETIREMENT_PROFILE)
    const gap = scoreRetirementAssessment(INCOME_GAP_RETIREMENT_PROFILE)
    assertFiniteMetrics(moderate)
    expect(moderate.overallScore).toBeLessThan(strong.overallScore)
    expect(moderate.overallScore).toBeGreaterThan(gap.overallScore)
  })

  it('3. flags a significant income gap', () => {
    const result = scoreRetirementAssessment(INCOME_GAP_RETIREMENT_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.annualIncomeGap).toBeGreaterThan(0)
    expect(result.overallScore).toBeLessThan(65)
  })

  it('4. handles an already-retired household with sustainability emphasis', () => {
    const result = scoreRetirementAssessment(ALREADY_RETIRED_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.isAlreadyRetired).toBe(true)
    expect(result.narrative.toLowerCase()).toMatch(/already retired|sustainability|withdrawal|healthcare|legacy/)
    expect(result.immediatePriorities.join(' ').toLowerCase()).toMatch(
      /withdraw|spending|healthcare|tax|legacy|sustain/,
    )
  })

  it('5. projects growth for a young household far from retirement', () => {
    const result = scoreRetirementAssessment(YOUNG_FAR_FROM_RETIREMENT_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.yearsUntilRetirement).toBe(37)
    expect(result.metrics.projectedNestEgg).toBeGreaterThan(result.metrics.currentSavings)
  })

  it('6. treats zero savings as a readiness weakness', () => {
    const result = scoreRetirementAssessment(ZERO_SAVINGS_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.currentSavings).toBe(0)
    const savings = result.categories.find((category) => category.id === 'savings')!
    expect(savings.score).toBeLessThan(40)
  })

  it('7. tolerates missing optional spouse data without NaN', () => {
    const result = scoreRetirementAssessment(MISSING_SPOUSE_DATA_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.socialSecurityMonthly).toBe(2500)
  })

  it('8. does not treat invalid retirement ages as already retired for scoring years', () => {
    // Scoring still computes, but validation must fail for the step.
    expect(isRetirementAgeValid(INVALID_RETIREMENT_AGE_PROFILE.household)).toBe(false)
    const result = scoreRetirementAssessment(INVALID_RETIREMENT_AGE_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.isAlreadyRetired).toBe(false)
  })

  it('9. handles zero income and spending safely', () => {
    const result = scoreRetirementAssessment(ZERO_INCOME_EXPENSES_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.targetAnnualRetirementSpending).toBe(0)
  })

  it('10. accepts extreme but valid values', () => {
    const result = scoreRetirementAssessment(EXTREME_VALID_PROFILE)
    assertFiniteMetrics(result)
    expect(result.metrics.projectedNestEgg).toBeGreaterThan(8_500_000)
  })

  it('does not let low-dollar multiple income sources produce an artificially strong income-sources score', () => {
    const result = scoreRetirementAssessment(LOW_DOLLAR_MULTI_SOURCE_PROFILE)
    assertFiniteMetrics(result)
    const incomeSources = result.categories.find((category) => category.id === 'income-sources')!
    expect(incomeSources.score).toBeLessThan(65)
    expect(result.metrics.guaranteedCoveragePercent).toBeLessThan(0.1)
  })

  it('does not mutate the input answers object', () => {
    const answers = structuredClone(MODERATE_RETIREMENT_PROFILE)
    const before = JSON.stringify(answers)
    scoreRetirementAssessment(answers)
    expect(JSON.stringify(answers)).toBe(before)
  })
})
