export type OwnerAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type BusinessInfoAnswers = {
  name: string
  industry: string
  yearsInBusiness: string
  employees: string
  grossAnnualRevenue: string
  ownerCompensationMethod: string
  ownerPersonalIncome: string
}

export type FoundationAnswers = {
  entityStructure: string
  operatingDocs: string
  financeSeparation: string
}

export type CashFlowTaxAnswers = {
  operatingCashFlow: string
  reserveMonths: string
  revenuePredictability: string
  acceptsCardPayments: string
  cardSalesPercentage: string
  estimatedProcessingRate: string
  lastProcessingReview: string
  taxPlanning: string
  taxBenefitStrategies: string
}

export type ProtectionRiskAnswers = {
  keyPersonBuySell: string
  continuityPlan: string
  coreInsurance: string
  specializedCoverage: string
}

export type RetirementFundingExitAnswers = {
  ownerRetirementSavings: string
  businessCredit: string
  growthCapital: string
  successionPlan: string
  valuationBaseline: string
}

export type BusinessGoalsAnswers = {
  selected: string[]
}

export type BusinessAssessmentAnswers = {
  owner: OwnerAnswers
  business: BusinessInfoAnswers
  foundation: FoundationAnswers
  cashFlowTax: CashFlowTaxAnswers
  protectionRisk: ProtectionRiskAnswers
  retirementFundingExit: RetirementFundingExitAnswers
  goals: BusinessGoalsAnswers
}

export const INITIAL_BUSINESS_ANSWERS: BusinessAssessmentAnswers = {
  owner: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  },
  business: {
    name: '',
    industry: '',
    yearsInBusiness: '',
    employees: '',
    grossAnnualRevenue: '',
    ownerCompensationMethod: '',
    ownerPersonalIncome: '',
  },
  foundation: {
    entityStructure: '',
    operatingDocs: '',
    financeSeparation: '',
  },
  cashFlowTax: {
    operatingCashFlow: '',
    reserveMonths: '',
    revenuePredictability: '',
    acceptsCardPayments: '',
    cardSalesPercentage: '',
    estimatedProcessingRate: '',
    lastProcessingReview: '',
    taxPlanning: '',
    taxBenefitStrategies: '',
  },
  protectionRisk: {
    keyPersonBuySell: '',
    continuityPlan: '',
    coreInsurance: '',
    specializedCoverage: '',
  },
  retirementFundingExit: {
    ownerRetirementSavings: '',
    businessCredit: '',
    growthCapital: '',
    successionPlan: '',
    valuationBaseline: '',
  },
  goals: {
    selected: [],
  },
}

function allFilled(values: Record<string, string>) {
  return Object.values(values).every((value) => value.trim() !== '')
}

export function isOwnerComplete(owner: OwnerAnswers) {
  return allFilled(owner)
}

export function isBusinessInfoComplete(business: BusinessInfoAnswers) {
  return allFilled(business)
}

export function isFoundationComplete(foundation: FoundationAnswers) {
  return allFilled(foundation)
}

export function isMerchantProcessingComplete(cashFlowTax: CashFlowTaxAnswers) {
  if (cashFlowTax.acceptsCardPayments !== 'yes') {
    return true
  }

  return (
    cashFlowTax.cardSalesPercentage.trim() !== '' &&
    cashFlowTax.estimatedProcessingRate.trim() !== '' &&
    cashFlowTax.lastProcessingReview.trim() !== ''
  )
}

export function isCashFlowTaxComplete(cashFlowTax: CashFlowTaxAnswers) {
  const baseComplete =
    cashFlowTax.operatingCashFlow.trim() !== '' &&
    cashFlowTax.reserveMonths.trim() !== '' &&
    cashFlowTax.revenuePredictability.trim() !== '' &&
    cashFlowTax.acceptsCardPayments.trim() !== '' &&
    cashFlowTax.taxPlanning.trim() !== '' &&
    cashFlowTax.taxBenefitStrategies.trim() !== ''

  return baseComplete && isMerchantProcessingComplete(cashFlowTax)
}

export function isProtectionRiskComplete(protectionRisk: ProtectionRiskAnswers) {
  return allFilled(protectionRisk)
}

export function isRetirementFundingExitComplete(retirementFundingExit: RetirementFundingExitAnswers) {
  return allFilled(retirementFundingExit)
}

export function isBusinessGoalsComplete(goals: BusinessGoalsAnswers) {
  return goals.selected.length > 0
}

export function isBusinessStepComplete(step: number, answers: BusinessAssessmentAnswers) {
  switch (step) {
    case 1:
      return true
    case 2:
      return isOwnerComplete(answers.owner) && isBusinessInfoComplete(answers.business)
    case 3:
      return isFoundationComplete(answers.foundation)
    case 4:
      return isCashFlowTaxComplete(answers.cashFlowTax)
    case 5:
      return isProtectionRiskComplete(answers.protectionRisk)
    case 6:
      return (
        isRetirementFundingExitComplete(answers.retirementFundingExit) &&
        isBusinessGoalsComplete(answers.goals)
      )
    default:
      return false
  }
}
