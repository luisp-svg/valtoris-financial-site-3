import type { SpecializedOption, SpecializedQuestion } from '../specialized/types'
import { CREDIT_DIAGNOSTIC_QUESTION_IDS } from './constants.js'

function options(prefix: string, values: readonly string[]): SpecializedOption[] {
  return values.map((value) => ({ value, labelKey: `${prefix}.${value}` }))
}

const YES_NO_NOT_SURE: readonly SpecializedOption[] = [
  { value: 'yes', labelKey: 'yes' },
  { value: 'no', labelKey: 'no' },
  { value: 'not_sure', labelKey: 'not_sure' },
]

export const CREDIT_QUESTIONS: readonly SpecializedQuestion[] = [
  {
    id: 'credit_goal',
    kind: 'single',
    diagnostic: true,
    labelKey: 'credit_goal',
    helperKey: 'credit_goal',
    fields: [
      {
        id: 'credit_goal',
        input: 'single',
        labelKey: 'credit_goal',
        placeholderKey: 'select',
        options: options('credit_goal', [
          'buy_home',
          'vehicle',
          'rent',
          'lower_rates',
          'business_financing',
          'rebuild_credit',
          'general_health',
        ]),
      },
    ],
  },
  {
    id: 'self_reported_score',
    kind: 'single',
    diagnostic: true,
    labelKey: 'self_reported_score',
    helperKey: 'self_reported_score',
    fields: [
      {
        id: 'self_reported_score',
        input: 'single',
        labelKey: 'self_reported_score',
        placeholderKey: 'select',
        options: options('self_reported_score', [
          '740_plus',
          '700_739',
          '660_699',
          '620_659',
          '580_619',
          'below_580',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'report_review',
    kind: 'group',
    diagnostic: true,
    labelKey: 'report_review',
    helperKey: 'report_review',
    fields: [
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
      {
        id: 'inaccuracy_belief',
        input: 'single',
        labelKey: 'inaccuracy_belief',
        helperKey: 'inaccuracy_belief',
        placeholderKey: 'select',
        options: YES_NO_NOT_SURE,
        when: { field: 'last_reviewed', notEquals: 'never' },
      },
    ],
  },
  {
    id: 'payment_history',
    kind: 'group',
    diagnostic: true,
    labelKey: 'payment_history',
    helperKey: 'payment_history',
    fields: [
      {
        id: 'late_recent',
        input: 'single',
        labelKey: 'late_recent',
        placeholderKey: 'select',
        options: options('late_recent', ['none', '30_days', '60_days', '90_plus', 'not_sure']),
      },
      {
        id: 'payment_consistency',
        input: 'single',
        labelKey: 'payment_consistency',
        placeholderKey: 'select',
        options: options('payment_consistency', [
          'on_time',
          'mostly_on_time',
          'missed_some',
          'currently_behind',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'negative_items',
    kind: 'multi',
    diagnostic: true,
    labelKey: 'negative_items',
    helperKey: 'negative_items',
    fields: [
      {
        id: 'negative_items',
        input: 'multi',
        labelKey: 'negative_items',
        options: options('negative_items', [
          'collections',
          'charge_offs',
          'repossession',
          'foreclosure',
          'bankruptcy',
          'other_derogatory',
          'none',
          'not_sure',
        ]),
        exclusiveValues: ['none', 'not_sure'],
      },
    ],
  },
  {
    id: 'utilization',
    kind: 'single',
    diagnostic: true,
    labelKey: 'utilization',
    helperKey: 'utilization',
    fields: [
      {
        id: 'utilization',
        input: 'single',
        labelKey: 'utilization',
        placeholderKey: 'select',
        options: options('utilization', [
          'under_10',
          '10_30',
          '30_50',
          '50_75',
          '75_plus',
          'maxed',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'credit_structure',
    kind: 'group',
    diagnostic: true,
    labelKey: 'credit_structure',
    helperKey: 'credit_structure',
    fields: [
      {
        id: 'open_revolving',
        input: 'single',
        labelKey: 'open_revolving',
        placeholderKey: 'select',
        options: options('open_revolving', ['0', '1_2', '3_5', '6_plus', 'not_sure']),
      },
      {
        id: 'oldest_account',
        input: 'single',
        labelKey: 'oldest_account',
        placeholderKey: 'select',
        options: options('oldest_account', ['under_2', '2_5', '5_10', '10_plus', 'not_sure']),
      },
    ],
  },
  {
    id: 'recent_credit',
    kind: 'group',
    diagnostic: true,
    labelKey: 'recent_credit',
    helperKey: 'recent_credit',
    fields: [
      {
        id: 'hard_inquiries',
        input: 'single',
        labelKey: 'hard_inquiries',
        placeholderKey: 'select',
        options: options('hard_inquiries', ['none', '1_2', '3_5', '6_plus', 'not_sure']),
      },
      {
        id: 'new_accounts',
        input: 'single',
        labelKey: 'new_accounts',
        placeholderKey: 'select',
        options: options('new_accounts', ['none', 'one', 'several', 'not_sure']),
      },
    ],
  },
  {
    id: 'financial_stability',
    kind: 'group',
    diagnostic: true,
    labelKey: 'financial_stability',
    helperKey: 'financial_stability',
    fields: [
      {
        id: 'minimums',
        input: 'single',
        labelKey: 'minimums',
        placeholderKey: 'select',
        options: options('minimums', ['comfortable', 'sometimes_difficult', 'struggling', 'not_sure']),
      },
      {
        id: 'current_status',
        input: 'single',
        labelKey: 'current_status',
        placeholderKey: 'select',
        options: options('current_status', ['current', 'past_due', 'not_sure']),
      },
    ],
  },
  {
    id: 'urgency_actions',
    kind: 'group',
    diagnostic: true,
    labelKey: 'urgency_actions',
    helperKey: 'urgency_actions',
    fields: [
      {
        id: 'urgency',
        input: 'single',
        labelKey: 'urgency',
        placeholderKey: 'select',
        options: options('urgency', ['asap', 'within_30_days', 'within_3_months', 'just_exploring']),
      },
      {
        id: 'prior_actions',
        input: 'multi',
        labelKey: 'prior_actions',
        options: options('prior_actions', [
          'self_disputes',
          'credit_counseling',
          'prior_repair_company',
          'none',
          'not_sure',
        ]),
        exclusiveValues: ['none', 'not_sure'],
      },
    ],
  },
]

if (CREDIT_QUESTIONS.length !== CREDIT_DIAGNOSTIC_QUESTION_IDS.length) {
  throw new Error('Credit diagnostic question count must stay at 10.')
}

export function creditQuestionById(id: string): SpecializedQuestion | undefined {
  return CREDIT_QUESTIONS.find((question) => question.id === id)
}

export function creditQuestionAt(index: number): SpecializedQuestion | undefined {
  return CREDIT_QUESTIONS[index]
}
