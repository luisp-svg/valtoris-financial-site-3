export type FamilyStepAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  state: string
  maritalStatus: string
  numberOfChildren: string
}

export type IncomeStepAnswers = {
  annualHouseholdIncome: string
  incomeReplacementYears: string
  customIncomeYears: string
}

export type HousingStepAnswers = {
  housingType: string
  annualMortgagePayment: string
  annualRentPayment: string
}

export type DebtStepAnswers = {
  creditCardDebt: string
  autoLoans: string
  personalLoans: string
  studentLoans: string
}

export type EducationStepAnswers = {
  numberOfChildren: string
  collegeFundPerChild: string
  customCollegeFund: string
}

export type FinalExpensesStepAnswers = {
  amount: string
  customAmount: string
}

export type CoverageStepAnswers = {
  currentLifeInsurance: string
}

export type CalculatorAnswers = {
  family: FamilyStepAnswers
  income: IncomeStepAnswers
  housing: HousingStepAnswers
  debt: DebtStepAnswers
  education: EducationStepAnswers
  finalExpenses: FinalExpensesStepAnswers
  coverage: CoverageStepAnswers
}

export const INITIAL_CALCULATOR_ANSWERS: CalculatorAnswers = {
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
  income: {
    annualHouseholdIncome: '',
    incomeReplacementYears: '15',
    customIncomeYears: '',
  },
  housing: {
    housingType: '',
    annualMortgagePayment: '',
    annualRentPayment: '',
  },
  debt: {
    creditCardDebt: '0',
    autoLoans: '0',
    personalLoans: '0',
    studentLoans: '0',
  },
  education: {
    numberOfChildren: '',
    collegeFundPerChild: '100000',
    customCollegeFund: '',
  },
  finalExpenses: {
    amount: '25000',
    customAmount: '',
  },
  coverage: {
    currentLifeInsurance: '0',
  },
}

function filled(value: string) {
  return value.trim() !== ''
}

function filledOrZero(value: string) {
  return value.trim() !== ''
}

export function isCalculatorStepComplete(step: number, answers: CalculatorAnswers): boolean {
  switch (step) {
    case 1:
      return Object.values(answers.family).every(filled)
    case 2: {
      const { annualHouseholdIncome, incomeReplacementYears, customIncomeYears } = answers.income
      if (!filled(annualHouseholdIncome) || !filled(incomeReplacementYears)) return false
      if (incomeReplacementYears === 'custom') return filled(customIncomeYears)
      return true
    }
    case 3: {
      const { housingType, annualMortgagePayment, annualRentPayment } = answers.housing
      if (!filled(housingType)) return false
      if (housingType === 'own') return filled(annualMortgagePayment)
      if (housingType === 'rent') return filled(annualRentPayment)
      return false
    }
    case 4:
      return Object.values(answers.debt).every(filledOrZero)
    case 5: {
      const { numberOfChildren, collegeFundPerChild, customCollegeFund } = answers.education
      if (!filled(numberOfChildren) || !filled(collegeFundPerChild)) return false
      if (collegeFundPerChild === 'custom') return filled(customCollegeFund)
      return true
    }
    case 6: {
      const { amount, customAmount } = answers.finalExpenses
      if (!filled(amount)) return false
      if (amount === 'custom') return filled(customAmount)
      return true
    }
    case 7:
      return filledOrZero(answers.coverage.currentLifeInsurance)
    default:
      return false
  }
}
