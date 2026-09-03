import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ROUTES,
  crmCommissionsPath,
  crmCommissionsPendingImportPath,
} from '../../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const migrationsDir = join(root, 'supabase/migrations')

function source(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('commission Pending Phase B contracts', () => {
  it('registers an owner-only nested pending-import route and keeps advisors off the button', () => {
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
    const workspace = readFileSync(join(root, 'crm/commissions/CommissionWorkspace.tsx'), 'utf8')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPendingImportPage.tsx'), 'utf8')
    const header = readFileSync(join(root, 'components/SiteHeader.tsx'), 'utf8')
    expect(ROUTES.crmCommissionsPendingImport).toBe('/crm/commissions/pending-import')
    expect(crmCommissionsPendingImportPath()).toBe('/crm/commissions/pending-import')
    expect(crmCommissionsPath()).toBe('/crm/commissions')
    expect(app).toContain('path="commissions/pending-import"')
    expect(app).toContain('CrmCommissionsPendingImportPage')
    expect(app.indexOf('CrmProtectedGate')).toBeLessThan(
      app.indexOf('path="commissions/pending-import"'),
    )
    expect(workspace).toContain('Import Pending Statement')
    expect(workspace).toContain('ROUTES.crmCommissionsPendingImport')
    expect(workspace).toContain('isOwner ? (')
    expect(page).toContain('shouldShowPendingImportEntry')
    expect(page).toContain('Navigate to={ROUTES.crmCommissions}')
    expect(header).not.toContain('/crm/commissions/pending-import')
  })

  it('stages only through 040 RPCs and never writes 035, 036 paid, or aliases', () => {
    const blob = [
      source('commissionPendingApi.ts'),
      source('CommissionPendingImportWorkspace.tsx'),
      source('CommissionPendingReviewPanel.tsx'),
      readFileSync(join(root, 'pages/crm/CrmCommissionsPendingImportPage.tsx'), 'utf8'),
    ].join('\n')
    expect(blob).toContain('create_commission_pending_import_batch')
    expect(blob).toContain('stage_commission_pending_import_rows')
    expect(blob).toContain('review_commission_pending_import_row')
    expect(blob).not.toContain('post_commission_pending')
    expect(blob).not.toContain('review_commission_import_row')
    expect(blob).not.toContain('post_commission_import_row')
    expect(blob).not.toContain('create_commission_import_batch')
    expect(blob).not.toContain('stage_commission_import_rows')
    expect(blob).not.toContain('record_policy_writing_commission_event')
    expect(blob).not.toContain('post_commission_import_row')
    expect(blob).not.toContain('SERVICE_ROLE')
    expect(blob).not.toMatch(/\.insert\s*\(/)
    expect(blob).not.toMatch(/\.update\s*\(/)
    expect(blob).not.toMatch(/\.delete\s*\(/)
    expect(blob).not.toContain('storage.from')
    expect(blob).not.toContain('Mark Ready')
    expect(blob).not.toContain('Post All')
    expect(blob).not.toContain('Post to Ledger')
    expect(blob).not.toContain('Accept Anyway')
    expect(blob).not.toContain('Force Accept')
  })

  it('does not add OCR, AI, PDF parsing, XLSX, or a commission lifecycle migration', () => {
    const blob = [
      source('commissionPendingApi.ts'),
      source('CommissionPendingImportWorkspace.tsx'),
      readFileSync(join(root, 'pages/crm/CrmCommissionsPendingImportPage.tsx'), 'utf8'),
      readFileSync(join(root, 'package.json'), 'utf8'),
    ].join('\n')
    expect(blob).not.toMatch(/pdf-parse|pdfjs|OCR|tesseract|openai|anthropic/i)
    expect(blob).not.toMatch(/xlsx|exceljs|sheetjs/i)
    expect(blob).not.toMatch(/P&C Commission|Student Loan Commission|Credit Repair Commission/)
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(54)
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
    expect(numbered.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(numbered.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(numbered).toContain('040_commission_pending_import.sql')
    expect(numbered).toContain('041_commission_pending_review.sql')
    expect(numbered).toContain('043_public_report_card_ingest.sql')
    expect(existsSync(join(migrationsDir, '040_commission_lifecycle.sql'))).toBe(false)
    expect(existsSync(join(migrationsDir, '039_commission_lifecycle.sql'))).toBe(false)
  })

  it('keeps Experior Pending as the only source and does not classify in the client', () => {
    const api = source('commissionPendingApi.ts')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPendingImportPage.tsx'), 'utf8')
    const workspace = source('CommissionPendingImportWorkspace.tsx')
    const panel = source('CommissionPendingReviewPanel.tsx')
    expect(api).toContain('p_source_type: EXPERIOR_PENDING_REPORT_SOURCE_TYPE')
    expect(page).toContain('parseCommissionImportCsv')
    expect(page).toContain('sha256HexFromBytes')
    expect(page).not.toContain('review_policy_match')
    expect(page).not.toContain('accepted_pending')
    expect(workspace).toContain('Accepted Pending')
    expect(workspace).toContain('Needs Review')
    expect(panel).toContain('Resolve')
    expect(panel).toContain('Confirm Duplicate')
    expect(panel).toContain('Confirm Distinct')
    expect(workspace).not.toContain('Post to Ledger')
    expect(panel).not.toContain('Post to Ledger')
    expect(workspace).not.toContain('Resolve for posting')
    expect(page).toContain('reviewCommissionPendingImportRow')
    expect(page).toContain('inFlightRef')
  })
})
