import { isValidEmailFormat, normalizeEmail, normalizePhone } from '../../../crm/households/normalizeContact.js'
import {
  BULK_LEAD_IMPORT_BATCH_ID,
  BULK_LEAD_IMPORT_RULESET_VERSION,
  BULK_LEAD_IMPORT_SHEET,
  BULK_LEAD_IMPORT_WORKBOOK,
  bulkLeadImportSheetRowRef,
} from '../../../modules/bulkLeadImport/constants.js'

export const BULK_LEAD_IMPORT_ALLOWED_KEYS = [
  'import_batch_id',
  'source_workbook',
  'source_sheet',
  'canonical_source_row',
  'all_source_rows',
  'first_name',
  'last_name',
  'middle_name',
  'raw_phone',
  'raw_email',
  'city',
  'state',
  'source_tag',
  'duplicate_type',
  'duplicate_group',
  'ruleset_version',
  'raw_payload',
] as const

export const BULK_LEAD_IMPORT_FORBIDDEN_KEYS = [
  'assigned_advisor_id',
  'original_advisor_id',
  'consent_snapshot',
  'contact_permission',
  'email_marketing_consent',
  'sms_marketing_consent',
  'consent_version',
  'consented_at',
  'pipeline_id',
  'relationship_pipeline_id',
  'stage_id',
  'relationship_stage_id',
  'lead_type',
  'lead_source',
  'status',
  'household_id',
  'household_status',
  'matched_household_id',
  'candidate_household_id',
] as const

export type BulkLeadImportIdentity = {
  canonicalSourceRow: number
  allSourceRows: number[]
  firstName: string
  lastName: string
  middleName?: string | null
  rawPhone?: string | null
  rawEmail?: string | null
  city?: string | null
  state?: string | null
  sourceTag?: string | null
  duplicateType?: string | null
  duplicateGroup?: string | null
  rulesetVersion?: string | null
  rawPayload?: Record<string, unknown>
}

export type BulkLeadImportRpcPayload = {
  import_batch_id: typeof BULK_LEAD_IMPORT_BATCH_ID
  source_workbook: typeof BULK_LEAD_IMPORT_WORKBOOK
  source_sheet: typeof BULK_LEAD_IMPORT_SHEET
  canonical_source_row: number
  all_source_rows: number[]
  first_name: string
  last_name: string
  middle_name?: string
  raw_phone?: string
  raw_email?: string
  city?: string
  state?: string
  source_tag?: string
  duplicate_type?: string
  duplicate_group?: string
  ruleset_version: string
  raw_payload?: Record<string, unknown>
}

export type BulkLeadImportPayloadError =
  | 'protected_field'
  | 'unsupported_batch'
  | 'missing_last_name'
  | 'invalid_name'
  | 'malformed_contact'
  | 'invalid_state'
  | 'invalid_payload'

export function assertNoProtectedBulkImportFields(
  record: Record<string, unknown>,
): BulkLeadImportPayloadError | null {
  for (const key of BULK_LEAD_IMPORT_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return 'protected_field'
  }
  return null
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function buildBulkLeadImportRpcPayload(
  identity: BulkLeadImportIdentity,
): { ok: true; payload: BulkLeadImportRpcPayload } | { ok: false; error: BulkLeadImportPayloadError } {
  const lastName = identity.lastName.trim()
  if (!lastName) return { ok: false, error: 'missing_last_name' }
  const firstName = identity.firstName.trim()
  if (!firstName || firstName.length > 100 || lastName.length > 100) {
    return { ok: false, error: 'invalid_name' }
  }

  const rawEmail = trimOrNull(identity.rawEmail)
  const rawPhone = trimOrNull(identity.rawPhone)
  if (rawEmail && !isValidEmailFormat(rawEmail)) return { ok: false, error: 'malformed_contact' }
  const normalizedEmail = normalizeEmail(rawEmail)
  const normalizedPhone = normalizePhone(rawPhone)
  if (!normalizedEmail && !normalizedPhone) return { ok: false, error: 'malformed_contact' }

  const city = trimOrNull(identity.city)
  const stateRaw = trimOrNull(identity.state)
  const state = stateRaw ? stateRaw.toUpperCase() : null
  if (state && !/^[A-Z]{2}$/.test(state)) return { ok: false, error: 'invalid_state' }

  const canonical = identity.canonicalSourceRow
  if (!Number.isInteger(canonical) || canonical < 1) return { ok: false, error: 'invalid_payload' }
  const allSourceRows = identity.allSourceRows.filter((row) => Number.isInteger(row) && row > 0)
  if (allSourceRows.length === 0 || !allSourceRows.includes(canonical)) {
    return { ok: false, error: 'invalid_payload' }
  }

  const payload: BulkLeadImportRpcPayload = {
    import_batch_id: BULK_LEAD_IMPORT_BATCH_ID,
    source_workbook: BULK_LEAD_IMPORT_WORKBOOK,
    source_sheet: BULK_LEAD_IMPORT_SHEET,
    canonical_source_row: canonical,
    all_source_rows: allSourceRows,
    first_name: firstName,
    last_name: lastName,
    ruleset_version: trimOrNull(identity.rulesetVersion) ?? BULK_LEAD_IMPORT_RULESET_VERSION,
  }

  const middleName = trimOrNull(identity.middleName)
  if (middleName) payload.middle_name = middleName
  if (rawPhone) payload.raw_phone = rawPhone
  if (rawEmail) payload.raw_email = rawEmail
  if (city) payload.city = city
  if (state) payload.state = state
  const sourceTag = trimOrNull(identity.sourceTag)
  if (sourceTag) payload.source_tag = sourceTag
  const duplicateType = trimOrNull(identity.duplicateType)
  if (duplicateType) payload.duplicate_type = duplicateType
  const duplicateGroup = trimOrNull(identity.duplicateGroup)
  if (duplicateGroup) payload.duplicate_group = duplicateGroup
  if (identity.rawPayload && typeof identity.rawPayload === 'object') {
    payload.raw_payload = identity.rawPayload
  }

  return { ok: true, payload }
}

export function classifyBulkLeadImportDryRun(identity: BulkLeadImportIdentity): {
  normalizedEmail: string | null
  normalizedPhone: string | null
  firstName: string
  lastName: string
  externalSheetRowRef: string
} {
  return {
    normalizedEmail: normalizeEmail(identity.rawEmail),
    normalizedPhone: normalizePhone(identity.rawPhone),
    firstName: identity.firstName.trim(),
    lastName: identity.lastName.trim(),
    externalSheetRowRef: bulkLeadImportSheetRowRef(identity.canonicalSourceRow),
  }
}
