import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const updateSql = readFileSync(join(here, '../../supabase/migrations/032_policy_production_foundation.sql'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const section = readFileSync(join(here, 'CaseOperationsSection.tsx'), 'utf8')
const view = readFileSync(join(here, 'caseOperationsView.ts'), 'utf8')
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const editForm = readFileSync(join(here, 'ApplicationEditForm.tsx'), 'utf8')
const editPage = readFileSync(join(here, '../../pages/crm/CrmProductionEditPage.tsx'), 'utf8')

describe('Phase 2 Case Operations contracts', () => {
  it('does not add a Case Operations migration; 045 is policy lifecycle only', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(52)
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '045_case_operations.sql'))).toBe(false)
    expect(updateSql).toContain('CREATE OR REPLACE FUNCTION public.update_policy_application(p_id uuid, p_payload jsonb)')
    expect(updateSql).toContain("WHEN v_app.production_stage = 'issued' THEN ARRAY[")
    expect(updateSql).toContain("'delivery_status'")
    expect(updateSql).toContain("ELSE ARRAY['notes', 'next_follow_up_date']")
  })

  it('keeps Case Operations on the existing Case workspace without a second edit route', () => {
    expect(detailPage).toContain('CaseOperationsSection')
    expect(detailPage).toContain('Edit Application')
    expect(detailPage).not.toContain('crmProductionOperationsPath')
    expect(section).toContain('Case Operations')
    expect(section).toContain('saveCaseOperations')
    expect(section).toContain('Save Case Operations')
    expect(section).toContain('onSaved()')
    expect(section).not.toContain('navigate(')
    expect(section).not.toContain('transitionPolicyApplicationStage')
  })

  it('separates the application note from Household Operational Notes', () => {
    expect(section).toContain('Application note')
    expect(section).toContain('Operational case note only — do not enter medical details.')
    expect(section).toContain('Household Operational Notes stay on the household timeline.')
    expect(detailPage).toContain('Household Operational Notes')
    expect(detailPage).toContain('OperationalNotesPanel')
    expect(detailPage).not.toContain('id="pp-notes-heading"')
    expect(section).not.toContain('notes.application_id')
    expect(section).not.toContain('diagnos')
    expect(section).not.toContain('medication')
  })

  it('restricts the mutation to approved operational keys on update_policy_application', () => {
    expect(applicationApi).toContain('export async function saveCaseOperations')
    expect(applicationApi).toContain('sanitizeCaseOperationsPatch(patch)')
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.update")
    expect(view).toContain("'next_follow_up_date'")
    expect(view).toContain("'notes'")
    expect(view).toContain("'is_replacement'")
    expect(view).toContain("'is_exchange_or_transfer'")
    expect(view).toContain("'delivery_status'")
    expect(view).not.toContain("'production_month'")
    expect(section).not.toContain('production_month')
    expect(section).not.toContain('submitted_premium_cents')
    expect(section).not.toContain('face_amount_cents')
    expect(section).not.toContain('policy_number')
    expect(section).not.toContain('writing_receivable_expected')
    expect(section).not.toContain('set_policy_application_allocations')
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(section).not.toMatch(/from\('policy_applications'\)/)
    expect(section).not.toMatch(/\.update\s*\(/)
    expect(applicationApi).not.toContain('SERVICE_ROLE')
    expect(detailPage).not.toContain('SERVICE_ROLE')
  })

  it('does not expose not_required or a free-form delivery dropdown', () => {
    expect(view).toContain("'not_started'")
    expect(view).toContain("'with_agent'")
    expect(view).toContain("'with_client'")
    expect(view).toContain("'requirements_pending'")
    expect(view).toContain("'complete'")
    expect(section).toContain('ISSUED_DELIVERY_EDIT_STATUSES.map')
    expect(section).toContain('Not required stays on the in-force transition')
    expect(section).not.toContain('<option value="not_required"')
    expect(section).not.toContain('<option value="pre_issue"')
    expect(editForm).not.toContain('delivery_status')
    expect(editPage).not.toContain('CaseOperationsSection')
  })

  it('uses 44px save/checkbox targets and stacked Case Operations fields on phone', () => {
    expect(styles).toContain('.crm-case-operations-actions .crm-primary-btn')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('.crm-case-operations .crm-checkbox-field')
    expect(styles).toContain('.crm-case-operations textarea')
    expect(styles).toContain(".crm-case-operations input[type='date']")
    expect(section).toContain('className="crm-checkbox-field"')
    expect(section).toContain('type="date"')
  })
})
