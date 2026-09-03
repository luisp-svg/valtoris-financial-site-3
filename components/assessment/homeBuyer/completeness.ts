import { isQuestionComplete } from '../specialized/answers'
import type { SpecializedAnswerMap } from '../specialized/types'
import {
  HOME_BUYER_CONTACT_STEP,
  HOME_BUYER_DIAGNOSTIC_QUESTION_IDS,
  HOME_BUYER_FIRST_DIAGNOSTIC_STEP,
  HOME_BUYER_LAST_DIAGNOSTIC_STEP,
} from './constants'
import { HOME_BUYER_QUESTIONS } from './questions'
import type { HomeBuyerAssessmentAnswers, HomeBuyerDiagnosticAnswers } from './types'

export function diagnosticToAnswerMap(diagnostic: HomeBuyerDiagnosticAnswers): SpecializedAnswerMap {
  return {
    self_reported_score_range: diagnostic.self_reported_score_range,
    last_reviewed: diagnostic.last_reviewed,
    credit_risk_flags: diagnostic.credit_risk_flags,
    household_income_band: diagnostic.household_income_band,
    employment_income_type: diagnostic.employment_income_type,
    tenure_stability: diagnostic.tenure_stability,
    monthly_debt_burden: diagnostic.monthly_debt_burden,
    estimated_dti_readiness: diagnostic.estimated_dti_readiness,
    liquid_savings_band: diagnostic.liquid_savings_band,
    emergency_reserve_months: diagnostic.emergency_reserve_months,
    housing_cost_burden: diagnostic.housing_cost_burden,
    cash_flow_cushion: diagnostic.cash_flow_cushion,
    down_payment_saved_pct: diagnostic.down_payment_saved_pct,
    gift_assistance_availability: diagnostic.gift_assistance_availability,
    documentation_ready: diagnostic.documentation_ready,
    buyer_history: diagnostic.buyer_history,
    intended_occupancy: diagnostic.intended_occupancy,
    current_housing: diagnostic.current_housing,
    target_timing: diagnostic.target_timing,
    readiness_confidence: diagnostic.readiness_confidence,
  }
}

export function answerMapToDiagnostic(
  values: SpecializedAnswerMap,
  previous: HomeBuyerDiagnosticAnswers,
): HomeBuyerDiagnosticAnswers {
  return {
    ...previous,
    self_reported_score_range:
      typeof values.self_reported_score_range === 'string'
        ? values.self_reported_score_range
        : previous.self_reported_score_range,
    last_reviewed: typeof values.last_reviewed === 'string' ? values.last_reviewed : previous.last_reviewed,
    credit_risk_flags: Array.isArray(values.credit_risk_flags)
      ? values.credit_risk_flags
      : previous.credit_risk_flags,
    household_income_band:
      typeof values.household_income_band === 'string'
        ? values.household_income_band
        : previous.household_income_band,
    employment_income_type:
      typeof values.employment_income_type === 'string'
        ? values.employment_income_type
        : previous.employment_income_type,
    tenure_stability:
      typeof values.tenure_stability === 'string' ? values.tenure_stability : previous.tenure_stability,
    monthly_debt_burden:
      typeof values.monthly_debt_burden === 'string'
        ? values.monthly_debt_burden
        : previous.monthly_debt_burden,
    estimated_dti_readiness:
      typeof values.estimated_dti_readiness === 'string'
        ? values.estimated_dti_readiness
        : previous.estimated_dti_readiness,
    liquid_savings_band:
      typeof values.liquid_savings_band === 'string'
        ? values.liquid_savings_band
        : previous.liquid_savings_band,
    emergency_reserve_months:
      typeof values.emergency_reserve_months === 'string'
        ? values.emergency_reserve_months
        : previous.emergency_reserve_months,
    housing_cost_burden:
      typeof values.housing_cost_burden === 'string'
        ? values.housing_cost_burden
        : previous.housing_cost_burden,
    cash_flow_cushion:
      typeof values.cash_flow_cushion === 'string' ? values.cash_flow_cushion : previous.cash_flow_cushion,
    down_payment_saved_pct:
      typeof values.down_payment_saved_pct === 'string'
        ? values.down_payment_saved_pct
        : previous.down_payment_saved_pct,
    gift_assistance_availability:
      typeof values.gift_assistance_availability === 'string'
        ? values.gift_assistance_availability
        : previous.gift_assistance_availability,
    documentation_ready: Array.isArray(values.documentation_ready)
      ? values.documentation_ready
      : previous.documentation_ready,
    buyer_history: typeof values.buyer_history === 'string' ? values.buyer_history : previous.buyer_history,
    intended_occupancy:
      typeof values.intended_occupancy === 'string' ? values.intended_occupancy : previous.intended_occupancy,
    current_housing:
      typeof values.current_housing === 'string' ? values.current_housing : previous.current_housing,
    target_timing: typeof values.target_timing === 'string' ? values.target_timing : previous.target_timing,
    readiness_confidence:
      typeof values.readiness_confidence === 'string'
        ? values.readiness_confidence
        : previous.readiness_confidence,
  }
}

export function isHomeBuyerDiagnosticComplete(diagnostic: HomeBuyerDiagnosticAnswers): boolean {
  const values = diagnosticToAnswerMap(diagnostic)
  return HOME_BUYER_QUESTIONS.every((question) => isQuestionComplete(question, values))
}

export function isHomeBuyerContactComplete(answers: HomeBuyerAssessmentAnswers): boolean {
  const { firstName, lastName, email, phone } = answers.contact
  return [firstName, lastName, email, phone].every((value) => value.trim() !== '')
}

export function isHomeBuyerStepComplete(step: number, answers: HomeBuyerAssessmentAnswers): boolean {
  if (step === HOME_BUYER_CONTACT_STEP) return isHomeBuyerContactComplete(answers)
  if (step < HOME_BUYER_FIRST_DIAGNOSTIC_STEP || step > HOME_BUYER_LAST_DIAGNOSTIC_STEP) {
    return false
  }
  const question = HOME_BUYER_QUESTIONS[step - HOME_BUYER_FIRST_DIAGNOSTIC_STEP]
  if (!question) return false
  return isQuestionComplete(question, diagnosticToAnswerMap(answers.diagnostic))
}

export function homeBuyerDiagnosticQuestionIds(): readonly string[] {
  return HOME_BUYER_DIAGNOSTIC_QUESTION_IDS
}
