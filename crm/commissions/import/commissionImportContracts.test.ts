import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTES, crmCommissionsImportPath, crmCommissionsPath } from '../../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const migrationsDir = join(root, 'supabase/migrations')

function source(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('commission Phase 3A contracts', () => {
  it('registers an owner-only nested import route and keeps advisors off the button', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
    const workspace = readFileSync(join(root, 'crm/commissions/CommissionWorkspace.tsx'), 'utf8')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8')
    const header = readFileSync(join(root, 'components/SiteHeader.tsx'), 'utf8')
    expect(ROUTES.crmCommissionsImport).toBe('/crm/commissions/import')
    expect(crmCommissionsImportPath()).toBe('/crm/commissions/import')
    expect(crmCommissionsPath()).toBe('/crm/commissions')
    expect(app).toContain('path="commissions/import"')
    expect(app).toContain('CrmCommissionsImportPage')
    expect(app.indexOf('CrmProtectedGate')).toBeLessThan(app.indexOf('path="commissions/import"'))
    expect(workspace).toContain('Import Statement')
    expect(workspace).toContain('isOwner ? (')
    expect(workspace).toContain('ROUTES.crmCommissionsImport')
    expect(page).toContain('shouldShowImportEntry')
    expect(page).toContain("Navigate to={ROUTES.crmCommissions}")
    expect(header).not.toContain('/crm/commissions/import')
  })

  it('reviews and posts only through 036 RPCs and never writes 035 or aliases', () => {
    const blob = [
      source('commissionImportApi.ts'),
      source('CommissionImportWorkspace.tsx'),
      source('CommissionImportReviewPanel.tsx'),
      source('commissionImportReview.ts'),
      readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8'),
    ].join('\n')
    expect(blob).toContain('create_commission_import_batch')
    expect(blob).toContain('stage_commission_import_rows')
    expect(blob).toContain('review_commission_import_row')
    expect(blob).toContain('post_commission_import_row')
    expect(blob).not.toContain('upsert_commission_import_carrier_alias')
    expect(blob).not.toContain('record_policy_writing_commission_event')
    expect(blob).not.toContain('record_policy_writing_commission_event_pre_issue')
    expect(blob).not.toContain('reverse_policy_writing_commission_event')
    expect(blob).not.toContain('attribute_unattributed_commission_event')
    expect(blob).not.toContain('SERVICE_ROLE')
    expect(blob).not.toMatch(/\.insert\s*\(/)
    expect(blob).not.toMatch(/\.update\s*\(/)
    expect(blob).not.toMatch(/\.delete\s*\(/)
    expect(blob).not.toContain('storage.from')
    expect(blob).not.toContain('Mark Ready')
    expect(blob).not.toContain('Post All')
    expect(blob).not.toContain('fetchProductionApplications')
  })

  it('does not add OCR, AI, PDF parsing, XLSX, or a commission lifecycle migration', () => {
    const blob = [
      source('commissionImportApi.ts'),
      source('commissionImportCsv.ts'),
      source('CommissionImportWorkspace.tsx'),
      readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8'),
      readFileSync(join(root, 'package.json'), 'utf8'),
    ].join('\n')
    expect(blob).not.toMatch(/pdf-parse|pdfjs|OCR|tesseract|openai|anthropic/i)
    expect(blob).not.toMatch(/xlsx|exceljs|sheetjs/i)
    expect(blob).not.toMatch(/P&C Commission|Student Loan Commission|Credit Repair Commission/)
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(53)
    expect(numbered[0]).toBe('001_extensions_and_enums.sql')
    expect(numbered[43]).toBe('044_policy_application_requirements.sql')
    expect(numbered[44]).toBe('045_policy_post_placement_lifecycle.sql')
    expect(numbered.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(numbered[45]).toBe('046_opportunity_case_conversion.sql')
    expect(numbered[46]).toBe('047_credit_repair_student_loan_sales_catalog.sql')
    expect(numbered[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(numbered.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(numbered.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(numbered.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(numbered.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(numbered.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(numbered.filter((name) => name.startsWith('054_'))).toEqual([])
    expect(numbered).toContain('040_commission_pending_import.sql')
    expect(numbered).toContain('041_commission_pending_review.sql')
    expect(numbered).toContain('043_public_report_card_ingest.sql')
    expect(existsSync(join(migrationsDir, '039_commission_lifecycle.sql'))).toBe(false)
  })

  it('keeps Experior as the only source and does not classify policy/advisor in the client', () => {
    const api = source('commissionImportApi.ts')
    const csv = source('commissionImportCsv.ts')
    const workspace = source('CommissionImportWorkspace.tsx')
    const view = source('commissionImportView.ts')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8')
    expect(api).toContain('p_source_type: EXPERIOR_PAID_REPORT_SOURCE_TYPE')
    expect(csv).not.toContain('policy_number_normalized')
    expect(csv).not.toContain('review_policy_match')
    expect(page).not.toContain('review_policy_match')
    expect(workspace).toContain('Multiple writing allocations exist.')
    expect(view).toContain('shouldShowImportEntry')
    expect(page).toContain('setReloadKey')
    expect(page).toContain('stageTargetBatchId')
    expect(page).toContain('canRetryStageIntoOpenBatch')
  })

  it('preserves Phase 1/2 owner actions on the commissions workspace', () => {
    const workspace = readFileSync(join(root, 'crm/commissions/CommissionWorkspace.tsx'), 'utf8')
    expect(workspace).toContain('onRecord')
    expect(workspace).toContain('onChargeback')
    expect(workspace).toContain('onPreIssue')
    expect(workspace).toContain('onReverse')
    expect(workspace).toContain('onAttribute')
    expect(workspace).toContain('Import Statement')
  })
})

describe('commission Phase 3B contracts', () => {
  it('keeps a single import route and owner-only review/post controls', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8')
    const panel = source('CommissionImportReviewPanel.tsx')
    expect(app).toContain('path="commissions/import"')
    expect(app).toContain('CrmCommissionsImportPage')
    expect(page).toContain('shouldShowImportEntry')
    expect(page).toContain("Navigate to={ROUTES.crmCommissions}")
    expect(page).toContain('reviewCommissionImportRow')
    expect(page).toContain('postCommissionImportRow')
    expect(page).toContain('setRowsNonce')
    expect(panel).toContain('Post to Ledger')
    expect(panel).toContain('Confirm Duplicate')
    expect(panel).toContain('Confirm Distinct')
    expect(panel).toContain('Resolve for posting')
    expect(panel).not.toContain('Mark Ready')
    expect(panel).not.toContain('Post All')
    expect(panel).not.toContain('carrier alias')
    expect(panel).not.toContain('Pending')
    expect(panel).not.toContain('Eligible')
    expect(panel).not.toContain('Released')
  })

  it('loads constrained application and allocation candidates on demand', () => {
    const api = source('commissionImportApi.ts')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8')
    expect(api).toContain("eq('policy_number_normalized'")
    expect(api).toContain('.limit(20)')
    expect(api).toContain("eq('application_id', applicationId)")
    expect(api).toContain("eq('allocation_role', 'writing')")
    expect(api).toContain("eq('transaction_fingerprint'")
    expect(api).not.toContain('fetchProductionApplications')
    expect(page).toContain('fetchImportApplicationCandidates')
    expect(page).toContain('fetchLiveWritingAllocations')
    expect(page).toContain('fetchFingerprintPeers')
    expect(page).toContain('inFlightRef')
    expect(page).toContain("openResolution(row, 'distinct', false)")
    expect(page).not.toContain('createSupabaseServiceRole')
    expect(page).not.toContain('SERVICE_ROLE')
  })

  it('keeps paid import isolated from pending staging and does not add a commission lifecycle migration', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(53)
    expect(numbered[0]).toBe('001_extensions_and_enums.sql')
    expect(numbered[43]).toBe('044_policy_application_requirements.sql')
    expect(numbered[44]).toBe('045_policy_post_placement_lifecycle.sql')
    expect(numbered.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(numbered[45]).toBe('046_opportunity_case_conversion.sql')
    expect(numbered[46]).toBe('047_credit_repair_student_loan_sales_catalog.sql')
    expect(numbered[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(numbered.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(numbered.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(numbered.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(numbered.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(numbered.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(numbered.filter((name) => name.startsWith('054_'))).toEqual([])
    expect(numbered).toContain('040_commission_pending_import.sql')
    expect(numbered).toContain('041_commission_pending_review.sql')
    expect(numbered).toContain('043_public_report_card_ingest.sql')
    expect(existsSync(join(migrationsDir, '039_commission_lifecycle.sql'))).toBe(false)
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8')
    const panel = source('CommissionImportReviewPanel.tsx')
    expect(page).not.toContain('create_commission_pending_import_batch')
    expect(page).not.toContain('stage_commission_pending_import_rows')
    expect(page).not.toMatch(/P&C|Student Loan|Credit Repair|Wills & Trusts|Tax Strategy/)
    expect(panel).not.toContain('Edit Posted Event')
    expect(source('commissionImportReview.ts')).toContain('existing Reverse workflow')
  })
})
