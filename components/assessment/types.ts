export type FamilyAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  state: string
  maritalStatus: string
  numberOfChildren: string
}

export type FinancialAnswers = {
  householdIncome: string
  monthlyHousingPayment: string
  totalDebt: string
  emergencyFundMonths: string
  monthlyCashFlow: string
  retirementContribution: string
}

export type ProtectionAnswers = {
  currentLifeInsurance: string
  hasDisabilityProtection: string
  hasWill: string
  hasTrust: string
  beneficiariesReviewed: string
  guardianDocumented: string
}

export type GoalsAnswers = {
  selected: string[]
}

export type DemoAssessmentAnswers = {
  family: FamilyAnswers
  financial: FinancialAnswers
  protection: ProtectionAnswers
  goals: GoalsAnswers
}

export const INITIAL_DEMO_ANSWERS: DemoAssessmentAnswers = {
  family: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    age: '',
    state: '',
    maritalStatus: '',
    numberOfChildren: '',
  },
  financial: {
    householdIncome: '',
    monthlyHousingPayment: '',
    totalDebt: '',
    emergencyFundMonths: '',
    monthlyCashFlow: '',
    retirementContribution: '',
  },
  protection: {
    currentLifeInsurance: '',
    hasDisabilityProtection: '',
    hasWill: '',
    hasTrust: '',
    beneficiariesReviewed: '',
    guardianDocumented: '',
  },
  goals: {
    selected: [],
  },
}

function allFilled(values: Record<string, string>) {
  return Object.values(values).every((value) => value.trim() !== '')
}

export function isFamilyComplete(family: FamilyAnswers) {
  return allFilled(family)
}

export function isFinancialComplete(financial: FinancialAnswers) {
  return allFilled(financial)
}

export function isProtectionBaseComplete(protection: ProtectionAnswers) {
  return (
    protection.currentLifeInsurance.trim() !== '' &&
    protection.hasDisabilityProtection.trim() !== '' &&
    protection.hasWill.trim() !== '' &&
    protection.hasTrust.trim() !== '' &&
    protection.beneficiariesReviewed.trim() !== ''
  )
}

export function isGuardianComplete(protection: ProtectionAnswers) {
  return protection.guardianDocumented.trim() !== ''
}

/** @deprecated Use isProtectionBaseComplete / isGuardianComplete */
export function isProtectionComplete(protection: ProtectionAnswers) {
  return isProtectionBaseComplete(protection) && isGuardianComplete(protection)
}

export function isGoalsComplete(goals: GoalsAnswers) {
  return goals.selected.length > 0
}

export function isDemoStepComplete(step: number, answers: DemoAssessmentAnswers) {
  switch (step) {
    case 1:
      return true
    case 2:
      return isFamilyComplete(answers.family)
    case 3:
      return isFinancialComplete(answers.financial)
    case 4:
      return isProtectionBaseComplete(answers.protection)
    case 5:
      return isGoalsComplete(answers.goals)
    default:
      return false
  }
}

/** @deprecated Use DemoAssessmentAnswers */
export type StepOneAnswers = FamilyAnswers
/** @deprecated Use INITIAL_DEMO_ANSWERS */
export const INITIAL_ANSWERS = { step1: INITIAL_DEMO_ANSWERS.family }
/** @deprecated */
export type AssessmentAnswers = { step1: FamilyAnswers }
/** @deprecated */
export function isStepOneComplete(step1: FamilyAnswers) {
  return isFamilyComplete(step1)
}
/** @deprecated */
export function isStepComplete(step: number, answers: { step1: FamilyAnswers }) {
  return step === 1 ? isFamilyComplete(answers.step1) : true
}
