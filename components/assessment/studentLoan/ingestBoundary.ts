/**
 * Student Loan CRM ingest stays disabled through Phase B.
 * Client scoring now exists, but server validation and score dispatch do not.
 * Do not POST student_loan, send a placeholder score, or mislabel as family.
 */

export const STUDENT_LOAN_CRM_INGEST_ENABLED = false

export const STUDENT_LOAN_INGEST_BLOCK_REASON = 'server_validation_required' as const

export const STUDENT_LOAN_INGEST_REQUIRES = [
  'phase_c_server_validation',
  'publicIngestCatalog',
] as const

export type StudentLoanSubmitBoundary = {
  readonly enabled: false
  readonly reason: typeof STUDENT_LOAN_INGEST_BLOCK_REASON
  readonly requires: typeof STUDENT_LOAN_INGEST_REQUIRES
}

export function canSubmitStudentLoanToCrm(): false {
  return STUDENT_LOAN_CRM_INGEST_ENABLED
}

export function getStudentLoanSubmitBoundary(): StudentLoanSubmitBoundary {
  return {
    enabled: false,
    reason: STUDENT_LOAN_INGEST_BLOCK_REASON,
    requires: STUDENT_LOAN_INGEST_REQUIRES,
  }
}
