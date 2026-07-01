import { CalculatorAnswers } from './types'

export type ProtectionBreakdown = {
  income: number
  housing: number
  debt: number
  education: number
  finalExpenses: number
  legacyFunds: number
  total: number
  netNeed: number
}

export function parseAmount(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function getAnnualHousing(answers: CalculatorAnswers): number {
  if (answers.housing.housingType === 'own') {
    return parseAmount(answers.housing.annualMortgagePayment)
  }
  if (answers.housing.housingType === 'rent') {
    return parseAmount(answers.housing.annualRentPayment)
  }
  return 0
}

function getCollegeFundPerChild(answers: CalculatorAnswers): number {
  if (answers.education.collegeFundPerChild === 'custom') {
    return parseAmount(answers.education.customCollegeFund)
  }
  return parseAmount(answers.education.collegeFundPerChild)
}

function getFinalExpenseAmount(answers: CalculatorAnswers): number {
  if (answers.finalExpenses.amount === 'custom') {
    return parseAmount(answers.finalExpenses.customAmount)
  }
  return parseAmount(answers.finalExpenses.amount)
}

export function getTotalDebt(answers: CalculatorAnswers): number {
  return (
    parseAmount(answers.debt.creditCardDebt) +
    parseAmount(answers.debt.autoLoans) +
    parseAmount(answers.debt.personalLoans) +
    parseAmount(answers.debt.studentLoans)
  )
}

function buildTier(
  answers: CalculatorAnswers,
  incomeYears: number,
  includeEducation: boolean,
  legacyFunds: number,
): ProtectionBreakdown {
  const annualIncome = parseAmount(answers.income.annualHouseholdIncome)
  const income = annualIncome * incomeYears
  const housing = getAnnualHousing(answers) * 5
  const debt = getTotalDebt(answers)
  const children = parseAmount(answers.education.numberOfChildren)
  const education = includeEducation ? children * getCollegeFundPerChild(answers) : 0
  const finalExpenses = getFinalExpenseAmount(answers)
  const total = income + housing + debt + education + finalExpenses + legacyFunds
  const existingCoverage = parseAmount(answers.coverage.currentLifeInsurance)
  const netNeed = Math.max(total - existingCoverage, 0)

  return {
    income,
    housing,
    debt,
    education,
    finalExpenses,
    legacyFunds,
    total,
    netNeed,
  }
}

export function calculateEssentialProtection(answers: CalculatorAnswers): ProtectionBreakdown {
  return buildTier(answers, 10, false, 0)
}

export function calculateRecommendedProtection(answers: CalculatorAnswers): ProtectionBreakdown {
  return buildTier(answers, 15, true, 0)
}

export function calculateLegacyProtection(answers: CalculatorAnswers): ProtectionBreakdown {
  const annualIncome = parseAmount(answers.income.annualHouseholdIncome)
  const legacyFunds = annualIncome * 5
  return buildTier(answers, 20, true, legacyFunds)
}

export function calculateSelectedNeed(answers: CalculatorAnswers): ProtectionBreakdown {
  const years =
    answers.income.incomeReplacementYears === 'custom'
      ? parseAmount(answers.income.customIncomeYears)
      : parseAmount(answers.income.incomeReplacementYears)

  return buildTier(answers, years || 15, true, 0)
}
