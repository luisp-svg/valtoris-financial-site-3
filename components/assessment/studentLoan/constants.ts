export const STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS = [
  'loan_types',
  'total_balance',
  'loan_status',
  'loan_servicer',
  'repayment_plan',
  'income_household',
  'employment',
  'payment_history',
  'previous_actions',
  'goal_urgency',
] as const

export type StudentLoanDiagnosticQuestionId = (typeof STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS)[number]

export const STUDENT_LOAN_CONTACT_STEP_ID = 'contact'

export const STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT = STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS.length

/** Welcome + 10 diagnostic groups + contact/consent. Contact is not a diagnostic question. */
export const STUDENT_LOAN_WELCOME_STEP = 1
export const STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP = 2
export const STUDENT_LOAN_LAST_DIAGNOSTIC_STEP = 11
export const STUDENT_LOAN_CONTACT_STEP = 12
export const STUDENT_LOAN_ASSESSMENT_STEPS = 12

export const STUDENT_LOAN_SERVICER_MAX_LENGTH = 80

export const STUDENT_LOAN_ANSWERS_STORAGE_KEY = 'valtoris-student-loan-answers'
export { STUDENT_LOAN_INGEST_SESSION_KEY } from '../../reportCard/familyIngest/submissionSession'

export const STUDENT_LOAN_PRODUCT_TITLE = 'Student Loan Report Card™'
export const STUDENT_LOAN_STORAGE_RESULT_NAME = 'Student Loan Report Card'

export const FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS = [
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
  'fsa',
  'studentaid',
  'account_number',
  'loan_account',
  'password',
  'pin',
] as const
