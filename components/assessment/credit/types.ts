export type CreditDiagnosticAnswers = {
  credit_goal: string
  self_reported_score: string
  last_reviewed: string
  inaccuracy_belief: string
  late_recent: string
  payment_consistency: string
  negative_items: string[]
  utilization: string
  open_revolving: string
  oldest_account: string
  hard_inquiries: string
  new_accounts: string
  minimums: string
  current_status: string
  urgency: string
  prior_actions: string[]
}

export type CreditContactAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type CreditAssessmentAnswers = {
  diagnostic: CreditDiagnosticAnswers
  contact: CreditContactAnswers
}

export const INITIAL_CREDIT_DIAGNOSTIC: CreditDiagnosticAnswers = {
  credit_goal: '',
  self_reported_score: '',
  last_reviewed: '',
  inaccuracy_belief: '',
  late_recent: '',
  payment_consistency: '',
  negative_items: [],
  utilization: '',
  open_revolving: '',
  oldest_account: '',
  hard_inquiries: '',
  new_accounts: '',
  minimums: '',
  current_status: '',
  urgency: '',
  prior_actions: [],
}

export const INITIAL_CREDIT_CONTACT: CreditContactAnswers = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
}

export const INITIAL_CREDIT_ANSWERS: CreditAssessmentAnswers = {
  diagnostic: { ...INITIAL_CREDIT_DIAGNOSTIC },
  contact: { ...INITIAL_CREDIT_CONTACT },
}
