/**
 * Student Loan public ingest uses the existing Report Card CRM path.
 * Server validation and score recalculation are required before persistence.
 */

export const STUDENT_LOAN_CRM_INGEST_ENABLED = true

export function canSubmitStudentLoanToCrm(): boolean {
  return STUDENT_LOAN_CRM_INGEST_ENABLED
}
