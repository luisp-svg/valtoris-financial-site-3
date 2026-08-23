import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')

function read(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('commission Phase C pending read contracts', () => {
  it('does not add a pending-dashboard migration and keeps 001–046 intact', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(48)
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
    expect(numbered.filter((name) => name.startsWith('049_'))).toEqual([])
    expect(numbered).toContain('040_commission_pending_import.sql')
    expect(numbered).toContain('041_commission_pending_review.sql')
    expect(numbered).toContain('042_writing_receivable_eligibility.sql')
    expect(numbered).toContain('043_public_report_card_ingest.sql')
    expect(existsSync(join(migrationsDir, '042_commission_pending_dashboard.sql'))).toBe(false)
  })

  it('reads accepted_pending only and never invokes pending or 035 write RPCs from the dashboard', () => {
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
    const api = read('commissionPendingReadApi.ts')
    const readModel = read('commissionPendingRead.ts')
    const summary = read('CommissionSummary.tsx')
    const workspace = read('CommissionWorkspace.tsx')
    const reporting = [api, readModel, summary, workspace].join('\n')
    expect(api).toContain("eq('pending_review_status', 'accepted_pending')")
    expect(api).toContain("from('commission_pending_import_rows')")
    expect(api).not.toContain('create_commission_pending_import_batch')
    expect(api).not.toContain('stage_commission_pending_import_rows')
    expect(api).not.toContain('review_commission_pending_import_row')
    expect(reporting).not.toContain('create_commission_pending_import_batch')
    expect(reporting).not.toContain('stage_commission_pending_import_rows')
    expect(reporting).not.toContain('review_commission_pending_import_row')
    expect(reporting).not.toContain('post_commission_import_row')
    expect(reporting).not.toContain('createSupabaseAdminClient')
    expect(reporting).not.toContain('SERVICE_ROLE')
    expect(page).toContain('createSupabaseBrowserClient')
    expect(page).toContain('fetchCommissionPendingDashboardSource')
    expect(page.match(/fetchCommissionPendingDashboardSource\(/g)?.length).toBe(1)
    expect(page).toContain('isOwner')
    expect(page).toContain('? fetchCommissionPendingDashboardSource')
    expect(page).toContain('if (!isOwner || item.pendingOnlyStub) return')
    expect(page.match(/item\.pendingOnlyStub/g)?.length).toBeGreaterThanOrEqual(6)
    expect(workspace).toContain('isOwner && pendingError')
    expect(page).not.toContain('create_commission_pending_import_batch')
    expect(page).not.toContain('stage_commission_pending_import_rows')
    expect(page).not.toContain('review_commission_pending_import_row')
    expect(page).not.toMatch(/\.insert\s*\(/)
    expect(page).not.toMatch(/\.update\s*\(/)
    expect(page).not.toMatch(/\.delete\s*\(/)
    expect(readModel).toContain('the latest')
    expect(readModel).toContain('accepted source fact')
    expect(readModel).not.toContain('source_split_rate')
    expect(summary).toContain('Source-confirmed Experior pending writing compensation.')
    expect(summary).not.toContain('Pending Paid')
    expect(workspace).not.toContain('create_commission_pending_import_batch')
    expect(workspace).not.toContain('Post to Ledger')
    expect(readFileSync(join(here, 'CommissionWorkItemDetail.tsx'), 'utf8')).toContain(
      'This is not Paid',
    )
    expect(read('commissionPendingRead.ts')).toContain('pendingOnlyStub: true')
    expect(read('commissionWriteView.ts')).toContain('isPendingOnlyCommissionStub(item)')
    expect(read('CommissionOwnerActions.tsx')).toContain('canRecordAttributedActual(isOwner, item)')
    expect(read('commissionPendingRead.ts')).toContain('pending-import row needs review')
  })

  it('keeps 040 owner-only SELECT and does not widen advisor RLS', () => {
    const sql = readFileSync(join(migrationsDir, '040_commission_pending_import.sql'), 'utf8')
    expect(sql).toContain('CREATE POLICY commission_pending_import_rows_select')
    expect(sql).toContain('USING (public.crm_is_owner())')
    expect(sql).not.toContain('crm_is_advisor')
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(48)
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
    expect(numbered.filter((name) => name.startsWith('049_'))).toEqual([])
    expect(numbered).toContain('042_writing_receivable_eligibility.sql')
    expect(numbered).toContain('043_public_report_card_ingest.sql')
    expect(existsSync(join(migrationsDir, '042_commission_pending_dashboard.sql'))).toBe(false)
  })
})
