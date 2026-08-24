export const CREDIT_DIAGNOSTIC_QUESTION_IDS = [
  'credit_goal',
  'self_reported_score',
  'report_review',
  'payment_history',
  'negative_items',
  'utilization',
  'credit_structure',
  'recent_credit',
  'financial_stability',
  'urgency_actions',
] as const

export type CreditDiagnosticQuestionId = (typeof CREDIT_DIAGNOSTIC_QUESTION_IDS)[number]

export const CREDIT_CONTACT_STEP_ID = 'contact'

export const CREDIT_DIAGNOSTIC_QUESTION_COUNT = CREDIT_DIAGNOSTIC_QUESTION_IDS.length

/** Welcome + 10 diagnostic groups + contact/consent. Contact is not a diagnostic question. */
export const CREDIT_WELCOME_STEP = 1
export const CREDIT_FIRST_DIAGNOSTIC_STEP = 2
export const CREDIT_LAST_DIAGNOSTIC_STEP = 11
export const CREDIT_CONTACT_STEP = 12
export const CREDIT_ASSESSMENT_STEPS = 12

export const CREDIT_ANSWERS_STORAGE_KEY = 'valtoris-credit-answers'
export const CREDIT_INGEST_SESSION_KEY = 'valtoris-credit-ingest-session'

export const CREDIT_PRODUCT_TITLE = 'Credit Report Card'
export const CREDIT_SCORE_NAME = 'Credit Report Card Score'
export const CREDIT_STORAGE_RESULT_NAME = 'Credit Report Card'

export const FORBIDDEN_CREDIT_FIELD_TOKENS = [
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
  'bureau_username',
  'bureau_password',
  'bureau_login',
  'fico_login',
  'vantage_login',
  'account_number',
  'collection_account',
  'creditor_account',
  'driver_license',
  'bank_password',
  'routing_number',
  'upload',
  'screenshot',
  'username',
  'password',
  'login',
  'credential',
  'security_answer',
  'token',
  'pin',
] as const
