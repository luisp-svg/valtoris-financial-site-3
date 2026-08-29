import { describe, expect, it } from 'vitest'
import { BULK_LEAD_IMPORT_BATCH_ID, BULK_LEAD_IMPORT_LEAD_TYPE } from '../../../modules/bulkLeadImport'
import { emptyConsentSnapshot } from '../familyReportCard/consent.js'
import {
  assertNoProtectedBulkImportFields,
  buildBulkLeadImportRpcPayload,
  classifyBulkLeadImportDryRun,
} from './payload.js'
import { assertBulkLeadImportBatchSize } from './runBulkLeadImport.js'

function identity(overrides: Record<string, unknown> = {}) {
  return {
    canonicalSourceRow: 5,
    allSourceRows: [5],
    firstName: 'Andre',
    lastName: 'Quek',
    rawPhone: '(713) 208-9809',
    rawEmail: 'aquek57@yahoo.com',
    city: 'Park Row',
    state: 'tx',
    sourceTag: '',
    ...overrides,
  }
}

describe('bulk lead import payload contract', () => {
  it('builds the approved RPC payload and re-normalizes contact fields', () => {
    const built = buildBulkLeadImportRpcPayload(identity())
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.payload.import_batch_id).toBe(BULK_LEAD_IMPORT_BATCH_ID)
    expect(built.payload).not.toHaveProperty('lead_type')
    expect(built.payload).not.toHaveProperty('assigned_advisor_id')
    expect(built.payload).not.toHaveProperty('consent_snapshot')
    expect(built.payload.state).toBe('TX')
    const preview = classifyBulkLeadImportDryRun(identity())
    expect(preview.normalizedEmail).toBe('aquek57@yahoo.com')
    expect(preview.normalizedPhone).toBe('+17132089809')
    expect(preview.externalSheetRowRef).toBe('2026_leads_crm:Leads:5')
  })

  it('rejects missing last name, malformed contact, and protected advisor fields', () => {
    const missingLast = buildBulkLeadImportRpcPayload(identity({ lastName: '   ' }))
    expect(missingLast.ok).toBe(false)
    if (!missingLast.ok) expect(missingLast.error).toBe('missing_last_name')
    const badEmail = buildBulkLeadImportRpcPayload(identity({ rawEmail: 'not-an-email', rawPhone: '' }))
    expect(badEmail.ok).toBe(false)
    if (!badEmail.ok) expect(badEmail.error).toBe('malformed_contact')
    const noContact = buildBulkLeadImportRpcPayload(identity({ rawEmail: '', rawPhone: '' }))
    expect(noContact.ok).toBe(false)
    if (!noContact.ok) expect(noContact.error).toBe('malformed_contact')
    const badState = buildBulkLeadImportRpcPayload(identity({ state: 'Texas' }))
    expect(badState.ok).toBe(false)
    if (!badState.ok) expect(badState.error).toBe('invalid_state')
    expect(assertNoProtectedBulkImportFields({ assigned_advisor_id: 'x' })).toBe('protected_field')
    expect(assertNoProtectedBulkImportFields({ consent_snapshot: { contactPermission: true } })).toBe(
      'protected_field',
    )
    expect(assertNoProtectedBulkImportFields({ pipeline_id: '22222222-2222-2222-2222-222222222201' })).toBe(
      'protected_field',
    )
  })

  it('preserves duplicate source rows and does not serialize emptyConsentSnapshot falses', () => {
    const built = buildBulkLeadImportRpcPayload(
      identity({
        canonicalSourceRow: 3,
        allSourceRows: [3, 763],
        sourceTag: '',
        duplicateType: 'EXACT_PHONE_EMAIL',
        duplicateGroup: 'EXACT-4ef163f8',
      }),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.payload.all_source_rows).toEqual([3, 763])
    expect(built.payload).not.toHaveProperty('consent_snapshot')
    const empty = emptyConsentSnapshot()
    expect(empty.contactPermission).toBe(false)
    expect(JSON.stringify(empty)).not.toBe('{}')
    expect(BULK_LEAD_IMPORT_LEAD_TYPE).toBe('Bulk Lead Import')
  })

  it('caps orchestration batches at 25–50', () => {
    expect(assertBulkLeadImportBatchSize(0)).toBe(25)
    expect(assertBulkLeadImportBatchSize(25)).toBe(25)
    expect(assertBulkLeadImportBatchSize(50)).toBe(50)
    expect(assertBulkLeadImportBatchSize(200)).toBe(50)
  })
})
