import { isQuestionComplete } from '../specialized/answers'
import type { SpecializedAnswerMap } from '../specialized/types'
import {
  STUDENT_LOAN_CONTACT_STEP,
  STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS,
  STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP,
  STUDENT_LOAN_LAST_DIAGNOSTIC_STEP,
  STUDENT_LOAN_WELCOME_STEP,
} from './constants'
import { STUDENT_LOAN_QUESTIONS } from './questions'
import type { StudentLoanAssessmentAnswers, StudentLoanDiagnosticAnswers } from './types'

export function diagnosticToAnswerMap(
  diagnostic: StudentLoanDiagnosticAnswers,
): SpecializedAnswerMap {
  return {
    loan_types: diagnostic.loan_types,
    total_balance: diagnostic.total_balance,
    loan_status: diagnostic.loan_status,
    servicer_mode: diagnostic.servicer_mode,
    servicer_name: diagnostic.servicer_name,
    knows_plan: diagnostic.knows_plan,
    current_plan: diagnostic.current_plan,
    income: diagnostic.income,
    household_size: diagnostic.household_size,
    employment_type: diagnostic.employment_type,
    employment_tenure: diagnostic.employment_tenure,
    payment_recent: diagnostic.payment_recent,
    payment_paused: diagnostic.payment_paused,
    previous_actions: diagnostic.previous_actions,
    primary_goal: diagnostic.primary_goal,
    urgency: diagnostic.urgency,
  }
}

export function answerMapToDiagnostic(
  values: SpecializedAnswerMap,
  previous: StudentLoanDiagnosticAnswers,
): StudentLoanDiagnosticAnswers {
  return {
    ...previous,
    loan_types: Array.isArray(values.loan_types) ? values.loan_types : previous.loan_types,
    total_balance: typeof values.total_balance === 'string' ? values.total_balance : previous.total_balance,
    loan_status: typeof values.loan_status === 'string' ? values.loan_status : previous.loan_status,
    servicer_mode: typeof values.servicer_mode === 'string' ? values.servicer_mode : previous.servicer_mode,
    servicer_name: typeof values.servicer_name === 'string' ? values.servicer_name : previous.servicer_name,
    knows_plan: typeof values.knows_plan === 'string' ? values.knows_plan : previous.knows_plan,
    current_plan: typeof values.current_plan === 'string' ? values.current_plan : previous.current_plan,
    income: typeof values.income === 'string' ? values.income : previous.income,
    household_size: typeof values.household_size === 'string' ? values.household_size : previous.household_size,
    employment_type:
      typeof values.employment_type === 'string' ? values.employment_type : previous.employment_type,
    employment_tenure:
      typeof values.employment_tenure === 'string' ? values.employment_tenure : previous.employment_tenure,
    payment_recent: typeof values.payment_recent === 'string' ? values.payment_recent : previous.payment_recent,
    payment_paused: typeof values.payment_paused === 'string' ? values.payment_paused : previous.payment_paused,
    previous_actions: Array.isArray(values.previous_actions)
      ? values.previous_actions
      : previous.previous_actions,
    primary_goal: typeof values.primary_goal === 'string' ? values.primary_goal : previous.primary_goal,
    urgency: typeof values.urgency === 'string' ? values.urgency : previous.urgency,
  }
}

export function isStudentLoanDiagnosticComplete(diagnostic: StudentLoanDiagnosticAnswers): boolean {
  const values = diagnosticToAnswerMap(diagnostic)
  return STUDENT_LOAN_QUESTIONS.every((question) => isQuestionComplete(question, values))
}

export function isStudentLoanContactComplete(answers: StudentLoanAssessmentAnswers): boolean {
  const { firstName, lastName, email, phone } = answers.contact
  return [firstName, lastName, email, phone].every((value) => value.trim() !== '')
}

export function isStudentLoanStepComplete(
  step: number,
  answers: StudentLoanAssessmentAnswers,
): boolean {
  if (step === STUDENT_LOAN_WELCOME_STEP) return true
  if (step === STUDENT_LOAN_CONTACT_STEP) return isStudentLoanContactComplete(answers)
  if (step < STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP || step > STUDENT_LOAN_LAST_DIAGNOSTIC_STEP) {
    return false
  }
  const question = STUDENT_LOAN_QUESTIONS[step - STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP]
  if (!question) return false
  return isQuestionComplete(question, diagnosticToAnswerMap(answers.diagnostic))
}

export function studentLoanDiagnosticQuestionIds(): readonly string[] {
  return STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS
}
