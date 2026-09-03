/**
 * Home Buyer diagnostic answers are self-reported public intake only.
 * Capture channel remains public_self_report. Do not add a verified bureau
 * schema or provider-specific fields, and do not overwrite these values
 * with a future shared credit-data service.
 */

export type HomeBuyerDiagnosticAnswers = {
  self_reported_score_range: string
  last_reviewed: string
  credit_risk_flags: string[]
  household_income_band: string
  employment_income_type: string
  tenure_stability: string
  monthly_debt_burden: string
  estimated_dti_readiness: string
  liquid_savings_band: string
  emergency_reserve_months: string
  housing_cost_burden: string
  cash_flow_cushion: string
  down_payment_saved_pct: string
  gift_assistance_availability: string
  documentation_ready: string[]
  buyer_history: string
  intended_occupancy: string
  current_housing: string
  target_timing: string
  readiness_confidence: string
}

export type HomeBuyerContactAnswers = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type HomeBuyerAssessmentAnswers = {
  diagnostic: HomeBuyerDiagnosticAnswers
  contact: HomeBuyerContactAnswers
}

export const INITIAL_HOME_BUYER_DIAGNOSTIC: HomeBuyerDiagnosticAnswers = {
  self_reported_score_range: '',
  last_reviewed: '',
  credit_risk_flags: [],
  household_income_band: '',
  employment_income_type: '',
  tenure_stability: '',
  monthly_debt_burden: '',
  estimated_dti_readiness: '',
  liquid_savings_band: '',
  emergency_reserve_months: '',
  housing_cost_burden: '',
  cash_flow_cushion: '',
  down_payment_saved_pct: '',
  gift_assistance_availability: '',
  documentation_ready: [],
  buyer_history: '',
  intended_occupancy: '',
  current_housing: '',
  target_timing: '',
  readiness_confidence: '',
}

export const INITIAL_HOME_BUYER_CONTACT: HomeBuyerContactAnswers = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
}

export const INITIAL_HOME_BUYER_ANSWERS: HomeBuyerAssessmentAnswers = {
  diagnostic: { ...INITIAL_HOME_BUYER_DIAGNOSTIC },
  contact: { ...INITIAL_HOME_BUYER_CONTACT },
}
