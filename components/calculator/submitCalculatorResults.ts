import { ROUTES } from '../../constants/routes'
import { buildMasterLeadPayload } from '../../utils/masterLeadPayload'
import { getSourcePage, submitLeadToGoogleSheets } from '../../utils/submitLeadToGoogleSheets'
import { calculateSelectedNeed, parseAmount } from './calculations'
import { CalculatorAnswers } from './types'

export type CalculatorSubmissionPayload = ReturnType<typeof buildCalculatorSubmissionPayload>

function getAnnualHousingPayment(answers: CalculatorAnswers): number {
  if (answers.housing.housingType === 'own') {
    return parseAmount(answers.housing.annualMortgagePayment)
  }
  if (answers.housing.housingType === 'rent') {
    return parseAmount(answers.housing.annualRentPayment)
  }
  return 0
}

function getEducationPerChild(answers: CalculatorAnswers): number {
  if (answers.education.collegeFundPerChild === 'custom') {
    return parseAmount(answers.education.customCollegeFund)
  }
  return parseAmount(answers.education.collegeFundPerChild)
}

function getFinalExpenseTotal(answers: CalculatorAnswers): number {
  if (answers.finalExpenses.amount === 'custom') {
    return parseAmount(answers.finalExpenses.customAmount)
  }
  return parseAmount(answers.finalExpenses.amount)
}

export function buildCalculatorSubmissionPayload(
  answers: CalculatorAnswers,
): CalculatorSubmissionPayload {
  const breakdown = calculateSelectedNeed(answers)
  const firstName = answers.family.firstName.trim()
  const lastName = answers.family.lastName.trim()
  const submittedAt = new Date().toISOString()

  return buildMasterLeadPayload({
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: answers.family.email.trim(),
    phone: answers.family.phone.trim(),
    age: answers.family.age.trim(),
    state: answers.family.state.trim(),
    maritalStatus: answers.family.maritalStatus.trim(),
    children: answers.family.numberOfChildren.trim(),
    annualIncome: parseAmount(answers.income.annualHouseholdIncome),
    housingType: answers.housing.housingType,
    annualHousing: getAnnualHousingPayment(answers),
    creditCards: parseAmount(answers.debt.creditCardDebt),
    autoLoans: parseAmount(answers.debt.autoLoans),
    personalLoans: parseAmount(answers.debt.personalLoans),
    studentLoans: parseAmount(answers.debt.studentLoans),
    educationPerChild: getEducationPerChild(answers),
    finalExpenses: getFinalExpenseTotal(answers),
    existingCoverage: parseAmount(answers.coverage.currentLifeInsurance),
    totalNeed: breakdown.total,
    overallScore: breakdown.total,
    overallGrade: '',
    protectionGap: breakdown.netNeed,
    sourcePage: getSourcePage() || ROUTES.protectionGap,
    rawAnswers: JSON.stringify(answers),
    submittedAt,
    timestamp: submittedAt,
  })
}

export async function submitCalculatorToGoogleSheets(
  answers: CalculatorAnswers,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const payload = buildCalculatorSubmissionPayload(answers)
  return submitLeadToGoogleSheets('Protection Gap', payload)
}
