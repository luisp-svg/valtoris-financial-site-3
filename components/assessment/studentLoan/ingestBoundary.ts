/**
 * Phase A must not persist Student Loan assessments to CRM.
 * Migration 048 allows assessment_type = student_loan, but server validation and
 * scoring still only support family | business | retirement | protection.
 * Sending a placeholder score, mislabeling as family, or bypassing validation
 * is forbidden. Phase B/C must add scoring + server validation first.
 */

export const STUDENT_LOAN_CRM_INGEST_ENABLED = false

export const STUDENT_LOAN_INGEST_BLOCK_REASON = 'scoring_and_server_validation_required' as const

export const STUDENT_LOAN_INGEST_REQUIRES = [
  'phase_b_scoring',
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
