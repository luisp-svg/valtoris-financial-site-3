export type StudentLoanDiagnosticAnswers = {
  loan_types: string[]
  total_balance: string
  loan_status: string
  servicer_mode: string
  servicer_name: string
  knows_plan: string
  current_plan: string
  income: string
  household_size: string
  employment_type: string
  employment_tenure: string
  payment_recent: string
  payment_paused: string
  previous_actions: string[]
  primary_goal: string
  urgency: string
}

export type StudentLoanContactAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type StudentLoanAssessmentAnswers = {
  diagnostic: StudentLoanDiagnosticAnswers
  contact: StudentLoanContactAnswers
}

export const INITIAL_STUDENT_LOAN_DIAGNOSTIC: StudentLoanDiagnosticAnswers = {
  loan_types: [],
  total_balance: '',
  loan_status: '',
  servicer_mode: '',
  servicer_name: '',
  knows_plan: '',
  current_plan: '',
  income: '',
  household_size: '',
  employment_type: '',
  employment_tenure: '',
  payment_recent: '',
  payment_paused: '',
  previous_actions: [],
  primary_goal: '',
  urgency: '',
}

export const INITIAL_STUDENT_LOAN_CONTACT: StudentLoanContactAnswers = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
}

export const INITIAL_STUDENT_LOAN_ANSWERS: StudentLoanAssessmentAnswers = {
  diagnostic: { ...INITIAL_STUDENT_LOAN_DIAGNOSTIC },
  contact: { ...INITIAL_STUDENT_LOAN_CONTACT },
}
