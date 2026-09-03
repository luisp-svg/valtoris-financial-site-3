export const HOME_BUYER_DIAGNOSTIC_QUESTION_IDS = [
  'credit_profile',
  'credit_risk_flags',
  'income_employment',
  'debt_dti_readiness',
  'savings_reserves',
  'cash_flow_housing',
  'down_payment_readiness',
  'documentation_readiness',
  'purchase_situation',
  'purchase_timeline',
] as const

export type HomeBuyerDiagnosticQuestionId = (typeof HOME_BUYER_DIAGNOSTIC_QUESTION_IDS)[number]

export const HOME_BUYER_CONTACT_STEP_ID = 'contact'

export const HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT = HOME_BUYER_DIAGNOSTIC_QUESTION_IDS.length

/**
 * Contact + consent first, then 10 diagnostic groups.
 * Contact does not count toward the 10. Welcome is not part of this engine.
 */
export const HOME_BUYER_CONTACT_STEP = 1
export const HOME_BUYER_FIRST_DIAGNOSTIC_STEP = 2
export const HOME_BUYER_LAST_DIAGNOSTIC_STEP = 11
export const HOME_BUYER_ASSESSMENT_STEPS = 11

export const HOME_BUYER_ANSWERS_STORAGE_KEY = 'valtoris-home-buyer-answers'
export const HOME_BUYER_INGEST_SESSION_KEY = 'valtoris-home-buyer-ingest-session'

export const HOME_BUYER_PRODUCT_TITLE = 'Home Buyer Report Card'
export const HOME_BUYER_SCORE_NAME = 'Home Buyer Report Card Score'
export const HOME_BUYER_STORAGE_RESULT_NAME = 'Home Buyer Report Card'

/**
 * All credit answers in this product are self-reported.
 * A future shared provider-neutral credit-data service must not overwrite these fields.
 */
export const HOME_BUYER_CREDIT_DATA_SOURCE = 'public_self_report' as const

export const FORBIDDEN_HOME_BUYER_FIELD_TOKENS = [
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
  'bureau_username',
  'bureau_password',
  'bureau_login',
  'fico_login',
  'vantage_login',
  'credit_login',
  'lender_username',
  'lender_password',
  'lender_login',
  'mortgage_login',
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
  'idiq',
  'verified_credit',
] as const
