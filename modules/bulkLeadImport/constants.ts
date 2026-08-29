/** Shared Bulk Lead Import constants. Safe for browser and server imports (no I/O). */

export const BULK_LEAD_IMPORT_LEAD_TYPE = 'Bulk Lead Import' as const

export const BULK_LEAD_IMPORT_HOUSEHOLD_LEAD_SOURCE = 'bulk_lead_import_2026_leads_crm' as const

export const BULK_LEAD_IMPORT_SOURCE_PAGE = 'bulk_import:2026_leads_crm:Leads' as const

export const BULK_LEAD_IMPORT_BATCH_ID = 'bulk_lead_import_2026_leads_crm_v1' as const

export const BULK_LEAD_IMPORT_WORKBOOK = '2026 leads crm' as const

export const BULK_LEAD_IMPORT_SHEET = 'Leads' as const

export const BULK_LEAD_IMPORT_RULESET_VERSION = 'phase_c_consumer_v1' as const

export const BULK_LEAD_IMPORT_RPC = 'import_bulk_lead_consumer' as const

export const BULK_LEAD_IMPORT_BATCH_SIZE = 25

export const BULK_LEAD_IMPORT_MAX_BATCH_SIZE = 50

export const RELATIONSHIP_PIPELINE_ID = '22222222-2222-2222-2222-222222222201' as const

export const RELATIONSHIP_NEW_LEAD_STAGE_ID = '33333333-3333-3333-3333-333333333001' as const

export type BulkLeadImportLeadType = typeof BULK_LEAD_IMPORT_LEAD_TYPE

export function bulkLeadImportSheetRowRef(canonicalSourceRow: number): string {
  return `2026_leads_crm:Leads:${canonicalSourceRow}`
}
