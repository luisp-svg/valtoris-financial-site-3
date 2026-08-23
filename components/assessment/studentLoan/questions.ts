import type { SpecializedOption, SpecializedQuestion } from '../specialized/types'
import { STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS, STUDENT_LOAN_SERVICER_MAX_LENGTH } from './constants'
import { STUDENT_LOAN_REPAYMENT_PLAN_OPTIONS } from './repaymentPlans'

function options(prefix: string, values: readonly string[]): SpecializedOption[] {
  return values.map((value) => ({ value, labelKey: `${prefix}.${value}` }))
}

const YES_NO_NOT_SURE: readonly SpecializedOption[] = [
  { value: 'yes', labelKey: 'yes' },
  { value: 'no', labelKey: 'no' },
  { value: 'not_sure', labelKey: 'not_sure' },
]

export const STUDENT_LOAN_QUESTIONS: readonly SpecializedQuestion[] = [
  {
    id: 'loan_types',
    kind: 'multi',
    diagnostic: true,
    labelKey: 'loan_types',
    helperKey: 'loan_types',
    fields: [
      {
        id: 'loan_types',
        input: 'multi',
        labelKey: 'loan_types',
        options: options('loan_types', ['direct', 'ffelp', 'parent_plus', 'private', 'not_sure']),
        exclusiveValues: ['not_sure'],
      },
    ],
  },
  {
    id: 'total_balance',
    kind: 'single',
    diagnostic: true,
    labelKey: 'total_balance',
    helperKey: 'total_balance',
    fields: [
      {
        id: 'total_balance',
        input: 'single',
        labelKey: 'total_balance',
        placeholderKey: 'select',
        options: options('total_balance', ['under_25k', '25k_50k', '50k_100k', 'over_100k', 'not_sure']),
      },
    ],
  },
  {
    id: 'loan_status',
    kind: 'single',
    diagnostic: true,
    labelKey: 'loan_status',
    helperKey: 'loan_status',
    fields: [
      {
        id: 'loan_status',
        input: 'single',
        labelKey: 'loan_status',
        placeholderKey: 'select',
        options: options('loan_status', [
          'repayment',
          'deferment_forbearance',
          'delinquent',
          'default',
          'not_sure',
        ]),
      },
    ],
  },
  {
    id: 'loan_servicer',
    kind: 'group',
    diagnostic: true,
    labelKey: 'loan_servicer',
    helperKey: 'loan_servicer',
    fields: [
      {
        id: 'servicer_mode',
        input: 'single',
        labelKey: 'servicer_mode',
        placeholderKey: 'select',
        options: [
          { value: 'named', labelKey: 'servicer_mode.named' },
          { value: 'not_sure', labelKey: 'servicer_mode.not_sure' },
        ],
      },
      {
        id: 'servicer_name',
        input: 'short_text',
        labelKey: 'servicer_name',
        helperKey: 'servicer_name',
        placeholderKey: 'servicer_name',
        maxLength: STUDENT_LOAN_SERVICER_MAX_LENGTH,
        when: { field: 'servicer_mode', equals: 'named' },
      },
    ],
  },
  {
    id: 'repayment_plan',
    kind: 'group',
    diagnostic: true,
    labelKey: 'repayment_plan',
    helperKey: 'repayment_plan',
    fields: [
      {
        id: 'knows_plan',
        input: 'single',
        labelKey: 'knows_plan',
        placeholderKey: 'select',
        options: YES_NO_NOT_SURE,
      },
      {
        id: 'current_plan',
        input: 'single',
        labelKey: 'current_plan',
        helperKey: 'current_plan',
        placeholderKey: 'select',
        options: STUDENT_LOAN_REPAYMENT_PLAN_OPTIONS,
        when: { field: 'knows_plan', equals: 'yes' },
      },
    ],
  },
  {
    id: 'income_household',
    kind: 'group',
    diagnostic: true,
    labelKey: 'income_household',
    helperKey: 'income_household',
    fields: [
      {
        id: 'income',
        input: 'single',
        labelKey: 'income',
        placeholderKey: 'select',
        options: options('income', [
          'under_40k',
          '40k_75k',
          '75k_125k',
          '125k_200k',
          '200k_plus',
          'not_sure',
        ]),
      },
      {
        id: 'household_size',
        input: 'single',
        labelKey: 'household_size',
        placeholderKey: 'select',
        options: options('household_size', ['1', '2', '3', '4', '5_plus']),
      },
    ],
  },
  {
    id: 'employment',
    kind: 'group',
    diagnostic: true,
    labelKey: 'employment',
    helperKey: 'employment',
    fields: [
      {
        id: 'employment_type',
        input: 'single',
        labelKey: 'employment_type',
        placeholderKey: 'select',
        options: options('employment_type', [
          'government',
          'nonprofit',
          'private',
          'self_employed',
          'not_employed',
        ]),
      },
      {
        id: 'employment_tenure',
        input: 'single',
        labelKey: 'employment_tenure',
        helperKey: 'employment_tenure',
        placeholderKey: 'select',
        options: options('employment_tenure', ['under_1', '1_5', '5_10', '10_plus']),
        when: {
          field: 'employment_type',
          in: ['government', 'nonprofit', 'private', 'self_employed'],
        },
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
        id: 'payment_recent',
        input: 'single',
        labelKey: 'payment_recent',
        placeholderKey: 'select',
        options: options('payment_recent', [
          'consistent',
          'missed_some',
          'difficult_to_afford',
          'not_currently_required',
          'have_not_been_paying',
          'not_sure',
        ]),
      },
      {
        id: 'payment_paused',
        input: 'single',
        labelKey: 'payment_paused',
        helperKey: 'payment_paused',
        placeholderKey: 'select',
        options: YES_NO_NOT_SURE,
      },
    ],
  },
  {
    id: 'previous_actions',
    kind: 'multi',
    diagnostic: true,
    labelKey: 'previous_actions',
    helperKey: 'previous_actions',
    fields: [
      {
        id: 'previous_actions',
        input: 'multi',
        labelKey: 'previous_actions',
        options: options('previous_actions', [
          'idr',
          'pslf',
          'federal_consolidation',
          'private_refinancing',
          'borrower_defense',
          'none',
          'not_sure',
        ]),
        exclusiveValues: ['none', 'not_sure'],
      },
    ],
  },
  {
    id: 'goal_urgency',
    kind: 'group',
    diagnostic: true,
    labelKey: 'goal_urgency',
    helperKey: 'goal_urgency',
    fields: [
      {
        id: 'primary_goal',
        input: 'single',
        labelKey: 'primary_goal',
        placeholderKey: 'select',
        options: options('primary_goal', [
          'lower_payment',
          'forgiveness_review',
          'exit_delinquency_default',
          'pay_off_faster',
          'prepare_home',
          'understand_options',
        ]),
      },
      {
        id: 'urgency',
        input: 'single',
        labelKey: 'urgency',
        placeholderKey: 'select',
        options: options('urgency', ['asap', 'within_30_days', 'within_3_months', 'just_exploring']),
      },
    ],
  },
]

if (STUDENT_LOAN_QUESTIONS.length !== STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS.length) {
  throw new Error('Student Loan diagnostic question count must stay at 10.')
}

export function studentLoanQuestionById(id: string): SpecializedQuestion | undefined {
  return STUDENT_LOAN_QUESTIONS.find((question) => question.id === id)
}

export function studentLoanQuestionAt(index: number): SpecializedQuestion | undefined {
  return STUDENT_LOAN_QUESTIONS[index]
}
