/**
 * Migration 050 enables the credit assessment_type in CRM.
 * Public Credit ingest stays closed until scoring and server validation exist.
 */

export const CREDIT_CRM_INGEST_ENABLED = false

export const CREDIT_CRM_INGEST_DISABLED_REASON = 'credit_scoring_and_server_validation_required'

export function canSubmitCreditToCrm(): boolean {
  return CREDIT_CRM_INGEST_ENABLED
}
