/**
 * Home Buyer public ingest uses the existing Report Card CRM path.
 * Server validation and score recalculation are required before persistence.
 */

export const HOME_BUYER_CRM_INGEST_ENABLED = true

export function canSubmitHomeBuyerToCrm(): boolean {
  return HOME_BUYER_CRM_INGEST_ENABLED
}
