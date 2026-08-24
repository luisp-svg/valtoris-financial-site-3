/**
 * Credit public ingest uses the existing Report Card CRM path.
 * Server validation and score recalculation are required before persistence.
 */

export const CREDIT_CRM_INGEST_ENABLED = true

export function canSubmitCreditToCrm(): boolean {
  return CREDIT_CRM_INGEST_ENABLED
}
