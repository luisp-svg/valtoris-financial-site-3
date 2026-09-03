import type { SpecializedOption, SpecializedQuestion } from '../specialized/types'
import { HOME_BUYER_DIAGNOSTIC_QUESTION_IDS } from './constants.js'

function options(prefix: string, values: readonly string[]): SpecializedOption[] {
  return values.map((value) => ({ value, labelKey: `${prefix}.${value}` }))
}

export const HOME_BUYER_QUESTIONS: readonly SpecializedQuestion[] = [
  {
    id: 'credit_profile',
    kind: 'group',
    diagnostic: true,
    labelKey: 'credit_profile',
    helperKey: 'credit_profile',
    fields: [
      {
        id: 'self_reported_score_range',
        input: 'single',
        labelKey: 'self_reported_score_range',
        placeholderKey: 'select',
        options: options('self_reported_score_range', [
          '740_plus',
          '700_739',
          '660_699',
          '620_659',
          '580_619',
          'below_580',
          'not_sure',
        ]),
      },
      {
        id: 'last_reviewed',
        input: 'single',
        labelKey: 'last_reviewed',
        placeholderKey: 'select',
        options: options('last_reviewed', [
          'last_30_days',
          'last_6_months',
          'last_year',
          'more_than_year',
          'never',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'credit_risk_flags',
    kind: 'multi',
    diagnostic: true,
    labelKey: 'credit_risk_flags',
    helperKey: 'credit_risk_flags',
    fields: [
      {
        id: 'credit_risk_flags',
        input: 'multi',
        labelKey: 'credit_risk_flags',
        options: options('credit_risk_flags', [
          'late_or_delinquent',
          'collections_charge_offs',
          'bankruptcy_foreclosure',
          'none',
          'not_sure',
        ]),
        exclusiveValues: ['none', 'not_sure'],
      },
    ],
  },
  {
    id: 'income_employment',
    kind: 'group',
    diagnostic: true,
    labelKey: 'income_employment',
    helperKey: 'income_employment',
    fields: [
      {
        id: 'household_income_band',
        input: 'single',
        labelKey: 'household_income_band',
        placeholderKey: 'select',
        options: options('household_income_band', [
          'under_50k',
          '50_75k',
          '75_100k',
          '100_150k',
          '150k_plus',
          'not_sure',
        ]),
      },
      {
        id: 'employment_income_type',
        input: 'single',
        labelKey: 'employment_income_type',
        placeholderKey: 'select',
        options: options('employment_income_type', [
          'w2',
          'self_employed',
          'contract_gig',
          'mixed',
          'retired_fixed',
          'not_working',
          'not_sure',
        ]),
      },
      {
        id: 'tenure_stability',
        input: 'single',
        labelKey: 'tenure_stability',
        placeholderKey: 'select',
        options: options('tenure_stability', [
          'under_1_year',
          '1_2_years',
          '2_plus_years',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'debt_dti_readiness',
    kind: 'group',
    diagnostic: true,
    labelKey: 'debt_dti_readiness',
    helperKey: 'debt_dti_readiness',
    fields: [
      {
        id: 'monthly_debt_burden',
        input: 'single',
        labelKey: 'monthly_debt_burden',
        placeholderKey: 'select',
        options: options('monthly_debt_burden', [
          'comfortable',
          'stretching',
          'difficult',
          'not_sure',
        ]),
      },
      {
        id: 'estimated_dti_readiness',
        input: 'single',
        labelKey: 'estimated_dti_readiness',
        placeholderKey: 'select',
        options: options('estimated_dti_readiness', [
          'under_36',
          '36_43',
          '43_50',
          'over_50',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'savings_reserves',
    kind: 'group',
    diagnostic: true,
    labelKey: 'savings_reserves',
    helperKey: 'savings_reserves',
    fields: [
      {
        id: 'liquid_savings_band',
        input: 'single',
        labelKey: 'liquid_savings_band',
        placeholderKey: 'select',
        options: options('liquid_savings_band', [
          'under_2k',
          '2_10k',
          '10_25k',
          '25_50k',
          '50k_plus',
          'not_sure',
        ]),
      },
      {
        id: 'emergency_reserve_months',
        input: 'single',
        labelKey: 'emergency_reserve_months',
        placeholderKey: 'select',
        options: options('emergency_reserve_months', [
          'under_1',
          '1_3',
          '3_6',
          '6_plus',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'cash_flow_housing',
    kind: 'group',
    diagnostic: true,
    labelKey: 'cash_flow_housing',
    helperKey: 'cash_flow_housing',
    fields: [
      {
        id: 'housing_cost_burden',
        input: 'single',
        labelKey: 'housing_cost_burden',
        placeholderKey: 'select',
        options: options('housing_cost_burden', [
          'under_30',
          '30_40',
          '40_50',
          'over_50',
          'not_sure',
        ]),
      },
      {
        id: 'cash_flow_cushion',
        input: 'single',
        labelKey: 'cash_flow_cushion',
        placeholderKey: 'select',
        options: options('cash_flow_cushion', [
          'leftover_comfortable',
          'leftover_tight',
          'none_or_negative',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'down_payment_readiness',
    kind: 'group',
    diagnostic: true,
    labelKey: 'down_payment_readiness',
    helperKey: 'down_payment_readiness',
    fields: [
      {
        id: 'down_payment_saved_pct',
        input: 'single',
        labelKey: 'down_payment_saved_pct',
        placeholderKey: 'select',
        options: options('down_payment_saved_pct', [
          'none',
          'under_5',
          '5_10',
          '10_20',
          '20_plus',
          'not_sure',
        ]),
      },
      {
        id: 'gift_assistance_availability',
        input: 'single',
        labelKey: 'gift_assistance_availability',
        placeholderKey: 'select',
        options: options('gift_assistance_availability', [
          'available',
          'possible',
          'none',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'documentation_readiness',
    kind: 'multi',
    diagnostic: true,
    labelKey: 'documentation_readiness',
    helperKey: 'documentation_readiness',
    fields: [
      {
        id: 'documentation_ready',
        input: 'multi',
        labelKey: 'documentation_ready',
        options: options('documentation_ready', [
          'income_docs',
          'bank_statements',
          'tax_docs',
          'government_id',
          'none',
          'not_sure',
        ]),
        exclusiveValues: ['none', 'not_sure'],
      },
    ],
  },
  {
    id: 'purchase_situation',
    kind: 'group',
    diagnostic: true,
    labelKey: 'purchase_situation',
    helperKey: 'purchase_situation',
    fields: [
      {
        id: 'buyer_history',
        input: 'single',
        labelKey: 'buyer_history',
        placeholderKey: 'select',
        options: options('buyer_history', ['first_time', 'repeat']),
      },
      {
        id: 'intended_occupancy',
        input: 'single',
        labelKey: 'intended_occupancy',
        placeholderKey: 'select',
        options: options('intended_occupancy', ['primary', 'second_home', 'investment']),
      },
      {
        id: 'current_housing',
        input: 'single',
        labelKey: 'current_housing',
        placeholderKey: 'select',
        options: options('current_housing', ['renting', 'own', 'living_with_family', 'other']),
      },
    ],
  },
  {
    id: 'purchase_timeline',
    kind: 'group',
    diagnostic: true,
    labelKey: 'purchase_timeline',
    helperKey: 'purchase_timeline',
    fields: [
      {
        id: 'target_timing',
        input: 'single',
        labelKey: 'target_timing',
        placeholderKey: 'select',
        options: options('target_timing', [
          '0_3_months',
          '3_6_months',
          '6_12_months',
          '12_plus',
          'exploring',
          'not_sure',
        ]),
      },
      {
        id: 'readiness_confidence',
        input: 'single',
        labelKey: 'readiness_confidence',
        placeholderKey: 'select',
        options: options('readiness_confidence', [
          'very_ready',
          'somewhat_ready',
          'early',
          'not_sure',
        ]),
      },
    ],
  },
]

if (HOME_BUYER_QUESTIONS.length !== HOME_BUYER_DIAGNOSTIC_QUESTION_IDS.length) {
  throw new Error('Home Buyer diagnostic question count must stay at 10.')
}

export function homeBuyerQuestionById(id: string): SpecializedQuestion | undefined {
  return HOME_BUYER_QUESTIONS.find((question) => question.id === id)
}

export function homeBuyerQuestionAt(index: number): SpecializedQuestion | undefined {
  return HOME_BUYER_QUESTIONS[index]
}
