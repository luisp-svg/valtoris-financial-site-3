import type { SpecializedAnswerMap } from '../specialized/types'
import { INITIAL_HOME_BUYER_DIAGNOSTIC, type HomeBuyerDiagnosticAnswers } from './types.js'
import { amount, incomeAndDebt } from './affordability.js'

/** Versioned compatibility projection; never substitute this for the underlying V2 evidence. */
export function projectV2Diagnostic(v2: SpecializedAnswerMap): HomeBuyerDiagnosticAnswers {
  const text = (key: string) => typeof v2[key] === 'string' ? v2[key] as string : ''
  const list = (key: string) => Array.isArray(v2[key]) ? [...v2[key]] : []
  const { income, debt } = incomeAndDebt(v2)
  const annual = income === null ? null : income * 12
  const savings = amount(v2.liquid_savings)
  const housing = amount(v2.current_housing_payment)
  const dti = income !== null && income > 0 && debt !== null && (v2.current_housing !== 'own' || housing !== null)
    ? (debt + (v2.current_housing === 'own' ? housing ?? 0 : 0)) / income : null
  const housingRatio = income !== null && income > 0 && housing !== null ? housing / income : null
  return {
    ...INITIAL_HOME_BUYER_DIAGNOSTIC, v2,
    self_reported_score_range: text('self_reported_score_range'), last_reviewed: text('last_reviewed'), credit_risk_flags: list('credit_risk_flags'),
    household_income_band: annual === null ? 'not_sure' : annual < 50000 ? 'under_50k' : annual < 75000 ? '50_75k' : annual < 100000 ? '75_100k' : annual < 150000 ? '100_150k' : '150k_plus',
    employment_income_type: income === null ? 'not_sure' : income <= 0 ? 'not_working' : 'mixed',
    tenure_stability: text('industry_years') === 'under_1' ? 'under_1_year' : text('industry_years') === '1_2' ? '1_2_years' : ['2_5', '5_plus'].includes(text('industry_years')) ? '2_plus_years' : 'not_sure',
    monthly_debt_burden: text('monthly_debt_burden'), estimated_dti_readiness: dti === null ? 'not_sure' : dti < 0.36 ? 'under_36' : dti <= 0.43 ? '36_43' : dti <= 0.5 ? '43_50' : 'over_50',
    liquid_savings_band: savings === null ? 'not_sure' : savings < 2000 ? 'under_2k' : savings < 10000 ? '2_10k' : savings < 25000 ? '10_25k' : savings < 50000 ? '25_50k' : '50k_plus',
    emergency_reserve_months: text('emergency_reserve_months'),
    housing_cost_burden: housingRatio === null ? 'not_sure' : housingRatio < 0.3 ? 'under_30' : housingRatio <= 0.4 ? '30_40' : housingRatio <= 0.5 ? '40_50' : 'over_50',
    cash_flow_cushion: text('cash_flow_cushion'),
    down_payment_saved_pct: text('down_payment_saved_pct'),
    gift_assistance_availability: text('gift_assistance_availability'), documentation_ready: list('documentation_ready'),
    buyer_history: text('buyer_history'), intended_occupancy: text('intended_occupancy'), current_housing: text('current_housing'),
    target_timing: text('target_timing') === 'asap' ? '0_3_months' : ['1_2_years', '2_plus_years'].includes(text('target_timing')) ? '12_plus' : text('target_timing'),
    readiness_confidence: text('readiness_confidence'),
  }
}
