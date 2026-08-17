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

  it('does not post, review, mutate aliases, or write 035 from import', () => {
    const blob = [
      source('commissionImportApi.ts'),
      source('CommissionImportWorkspace.tsx'),
      readFileSync(join(root, 'pages/crm/CrmCommissionsImportPage.tsx'), 'utf8'),
    ].join('\n')
    expect(blob).toContain('create_commission_import_batch')
    expect(blob).toContain('stage_commission_import_rows')
    expect(blob).not.toContain('post_commission_import_row')
    expect(blob).not.toContain('review_commission_import_row')
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
  })

  it('does not add OCR, AI, PDF parsing, XLSX, or Migration 039', () => {
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
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name))
    expect(numbered).toHaveLength(38)
    expect(numbered.some((name) => name.startsWith('039'))).toBe(false)
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
    expect(workspace).toContain('onPreIssue')
    expect(workspace).toContain('onReverse')
    expect(workspace).toContain('onAttribute')
    expect(workspace).toContain('Import Statement')
  })
})
