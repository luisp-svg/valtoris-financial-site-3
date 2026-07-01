import { GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL } from '../../constants/urls'
import { calculateSelectedNeed, parseAmount } from './calculations'
import { CalculatorAnswers } from './types'

export type CalculatorSubmissionPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  state: string
  maritalStatus: string
  children: string
  annualIncome: number
  housingType: string
  annualHousing: number
  creditCards: number
  autoLoans: number
  personalLoans: number
  studentLoans: number
  educationPerChild: number
  finalExpenses: number
  existingCoverage: number
  totalNeed: number
  protectionGap: number
  submittedAt: string
}

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

  return {
    firstName: answers.family.firstName.trim(),
    lastName: answers.family.lastName.trim(),
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
    protectionGap: breakdown.netNeed,
    submittedAt: new Date().toISOString(),
  }
}

export async function submitCalculatorToGoogleSheets(
  answers: CalculatorAnswers,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const payload = buildCalculatorSubmissionPayload(answers)

  console.log('Submitting calculator lead')
  console.log('Payload:', payload)
  console.log('Webhook URL:', GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL)

  try {
    const response = await fetch(GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log('Response status:', response.status)
    console.log('Response text:', responseText)

    if (!response.ok) {
      return { ok: false, error: new Error(`Webhook responded with ${response.status}: ${responseText}`) }
    }

    return { ok: true }
  } catch (error) {
    console.log('Response status: request failed')
    console.log('Response text:', error)
    return { ok: false, error }
  }
}
