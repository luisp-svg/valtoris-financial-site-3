import type { SpecializedOption } from '../specialized/types'

/**
 * Versioned Student Loan repayment-plan catalog.
 * Federal program names live here — not in schema, not as a DB enum.
 *
 * Terminology last verified: 2026-08-22
 * Authoritative source category: U.S. Department of Education / Federal Student Aid
 * (StudentAid.gov, FSA Partners Knowledge Center, and official *.studentaid.gov servicer pages).
 *
 * Reverify federal repayment terminology before any future public launch or
 * major repayment-plan edit. Borrower eligibility varies by loan type and
 * disbursement date and must not be inferred from selecting a plan.
 *
 * Catalog version 2 is additive: existing canonical values stay accepted.
 * Scoring version remains 1 and stays plan-neutral (recognized / other / not sure).
 */
export const STUDENT_LOAN_REPAYMENT_TERMINOLOGY_VERIFIED_ON = '2026-08-22'

export const STUDENT_LOAN_REPAYMENT_TERMINOLOGY_SOURCE_CATEGORY =
  'U.S. Department of Education / Federal Student Aid (StudentAid.gov and FSA Partners)'

export const STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION = 2

export const STUDENT_LOAN_REPAYMENT_PLAN_VALUES = [
  'rap',
  'tiered_standard',
  'standard',
  'ibr',
  'paye',
  'icr',
  'save',
  'repaye',
  'other',
  'not_sure',
] as const

export type StudentLoanRepaymentPlanValue = (typeof STUDENT_LOAN_REPAYMENT_PLAN_VALUES)[number]

export const STUDENT_LOAN_LEGACY_REPAYMENT_PLAN_VALUES = ['save', 'repaye'] as const

export const STUDENT_LOAN_REPAYMENT_PLAN_OPTIONS: readonly SpecializedOption[] =
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES.map((value) => ({
    value,
    labelKey: `current_plan.${value}`,
  }))
