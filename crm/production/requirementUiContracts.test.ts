import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { REQUIREMENTS_EMPTY_COPY } from './requirementCatalog'
import { isOpenRequirementOverdue } from './requirementView'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const section = readFileSync(join(here, 'RequirementSection.tsx'), 'utf8')
const api = readFileSync(join(here, 'requirementApi.ts'), 'utf8')
const catalog = readFileSync(join(here, 'requirementCatalog.ts'), 'utf8')
const view = readFileSync(join(here, 'requirementView.ts'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const appSource = readFileSync(join(here, '../../src/App.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const casesTab = readFileSync(join(here, '../households/ClientWorkspace/tabs/CasesTab.tsx'), 'utf8')
const board = readFileSync(join(here, 'ProductionBoard.tsx'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')

describe('Case Management Phase 2B requirement UI contracts', () => {
  it('adds the Requirements section to the existing Case detail route only', () => {
    expect(detailPage).toContain('RequirementSection')
    expect(appSource).toContain('path="production/:applicationId"')
    expect(appSource).toContain('CrmProductionDetailPage')
    expect(detailPage).not.toContain('/crm/cases')
    expect(section).toContain('REQUIREMENTS_EMPTY_COPY')
    expect(REQUIREMENTS_EMPTY_COPY).toContain('does not mean the carrier has none')
    expect(existsSync(join(here, '../../pages/crm/CrmCasesPage.tsx'))).toBe(false)
  })

  it('keeps writes on approved RPCs and never uses browser DML or service role', () => {
    expect(api).toContain("rpc(REQUIREMENT_RPC.create")
    expect(api).toContain("rpc(REQUIREMENT_RPC.update")
    expect(api).toContain("rpc(REQUIREMENT_RPC.transition")
    expect(api).toContain("rpc(REQUIREMENT_RPC.softDelete")
    expect(api).not.toMatch(/\.insert\s*\(/)
    expect(api).not.toMatch(/\.update\s*\(/)
    expect(api).not.toMatch(/\.delete\s*\(/)
    expect(api).not.toContain('SERVICE_ROLE')
    expect(section).not.toContain('SERVICE_ROLE')
    expect(section).not.toMatch(/\.insert\s*\(/)
    expect(detailPage).not.toContain('SERVICE_ROLE')
    expect(productionApi).not.toContain('create_policy_application_requirement')
  })

  it('does not add a cases table, sibling FKs, notes, PHI, or commission writes', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
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
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
    expect(section).not.toMatch(/from\('cases'\)/)
    expect(section).not.toMatch(/<textarea[^>]*(notes|diagnosis|medication|lab)/i)
    expect(section).not.toContain('created_by_user_id')
    expect(section).not.toContain('changed_by_user_id')
    expect(section).not.toContain('expected_compensation')
    expect(section).not.toContain('transition_policy_application_stage')
    expect(api).not.toContain('transition_policy_application_stage')
    expect(catalog).toContain('Short carrier ask — no medical details.')
    expect(section).toContain('maxLength={REQUIREMENT_CUSTOM_LABEL_MAX}')
    expect(section).toContain('maxLength={REQUIREMENT_REOPEN_REASON_MAX}')
    expect(section).toContain('REOPEN_REASON_HINT')
    expect(section).toContain('OTHER_LABEL_HINT')
  })

  it('keeps Case Detail as the requirement-management surface and reuses the shared overdue helper on summary views', () => {
    expect(view).toContain('isOpenRequirementOverdue')
    expect(view).toContain('overdueRequirementCountsByApplicationId')
    expect(section).toContain('isOpenRequirementOverdue')
    expect(queuePage).toContain('fetchOverdueRequirementCountsByApplicationIds')
    expect(queuePage).not.toContain('fetchApplicationRequirements')
    expect(queuePage).not.toContain('RequirementSection')
    expect(board).not.toContain('fetchApplicationRequirements')
    expect(casesTab).toContain('fetchOverdueRequirementCountsByApplicationIds')
    expect(casesTab).not.toContain('fetchApplicationRequirements')
    expect(
      isOpenRequirementOverdue(
        { status: 'open', due_date: '2026-01-01' },
        '2026-08-20',
      ),
    ).toBe(true)
  })

  it('shows owner-only delete and cancelled without status actions', () => {
    expect(section).toContain('canSoftDeleteRequirement(role)')
    expect(section).toContain('requirementStatusActions(row.status)')
    expect(section).toContain('History')
    expect(section).toContain('entry.reason')
    expect(section).not.toContain('changed_by_user_id')
    expect(section).toContain('Cancel is the usual action')
  })
})
