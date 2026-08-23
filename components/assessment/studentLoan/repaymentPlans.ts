import type { SpecializedOption } from '../specialized/types'

/**
 * Versioned Student Loan repayment-plan catalog.
 * Federal program names live here — not in schema, not as a DB enum.
 */
export const STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION = 1

export const STUDENT_LOAN_REPAYMENT_PLAN_VALUES = [
  'standard',
  'save',
  'ibr',
  'paye',
  'repaye',
  'icr',
  'other',
  'not_sure',
] as const

export type StudentLoanRepaymentPlanValue = (typeof STUDENT_LOAN_REPAYMENT_PLAN_VALUES)[number]

export const STUDENT_LOAN_REPAYMENT_PLAN_OPTIONS: readonly SpecializedOption[] =
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES.map((value) => ({
    value,
    labelKey: `current_plan.${value}`,
  }))
