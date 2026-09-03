import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { isLegitimateSubmittedApplication } from './productionMetrics'
import { isOperationalPolicyCase } from './caseWorkspace'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(root, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('Life & Annuity Case Management Phase A contracts', () => {
  const queuePage = source('pages/crm/CrmProductionPage.tsx')
  const appRoutes = source('src/App.tsx')
  const routes = source('constants/routes.ts')
  const caseWorkspace = source('crm/production/caseWorkspace.ts')
  const convertApi = source('crm/opportunities/convertOpportunityApi.ts')
  const convertView = source('crm/opportunities/convertOpportunityView.ts')
  const labels = source('crm/production/labels.ts')
  const dashboard = source('crm/production/ProductionDashboard.tsx')
  const casesTab = source('crm/households/ClientWorkspace/tabs/CasesTab.tsx')
  const openCasesWidget = source('crm/households/ClientWorkspace/widgets/OpenCasesWidget.tsx')

  it('does not add a Case 053, a cases table, or a /crm/cases route', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '053_case_management.sql'))).toBe(false)
    expect(caseWorkspace).toContain('No public.cases table')
    expect(appRoutes).not.toMatch(/path=["']cases["']/)
    expect(routes).not.toContain('/crm/cases')
    expect(queuePage).toContain("ROUTES.crmProductionNew")
    expect(queuePage).not.toContain('/crm/cases')
  })

  it('keeps migrations 047–052 unchanged and credit_repair disabled', () => {
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })

  it('reuses isLegitimateSubmittedApplication as the operational Case definition', () => {
    expect(caseWorkspace).toContain('isLegitimateSubmittedApplication')
    expect(caseWorkspace).toContain('function isOperationalPolicyCase')
    expect(isOperationalPolicyCase({ production_stage: 'draft', submission_date: '2026-06-15' })).toBe(
      false,
    )
    expect(
      isLegitimateSubmittedApplication({
        production_stage: 'submitted',
        submission_date: '2026-06-15',
      }),
    ).toBe(true)
    expect(isOperationalPolicyCase({ production_stage: 'submitted', submission_date: '2026-06-15' })).toBe(
      true,
    )
  })

  it('filters My Cases with existing writing allocations and fetchCurrentAdvisorProfileId only', () => {
    expect(caseWorkspace).toContain('getWritingAdvisorIds')
    expect(caseWorkspace).toContain('isLoadedWritingAdvisorCase')
    expect(caseWorkspace).not.toMatch(/bypass|security definer|SECURITY DEFINER/i)
    expect(queuePage).toContain('fetchCurrentAdvisorProfileId')
    expect(queuePage).toContain('writingAdvisorId')
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(queuePage).not.toMatch(/\.rpc\s*\(/)
  })

  it('keeps owner All Cases on the loaded Production dataset and uses role-aware advisor copy', () => {
    expect(queuePage).toContain('applyCaseWorkspaceView(filteredItems, caseView, now, caseViewOptions)')
    expect(queuePage).toContain('buildProductionDashboard(filteredItems, { period: productionPeriod, today })')
    expect(queuePage).not.toMatch(/buildProductionDashboard\([^)]*caseItems/)
    expect(queuePage).not.toContain('fetchProductionApplications(supabase, { limit: ')
    expect(caseWorkspace).toContain("viewer === 'owner' ? 'All Cases' : 'Visible Cases'")
    expect(caseWorkspace).toContain("viewer === 'owner' ? 'All Applications' : 'Visible applications'")
    expect(queuePage).toContain('caseWorkspaceViewerFromRole')
    expect(queuePage).not.toMatch(/firm-wide|entire book of the firm/i)
  })

  it('keeps Case-facing Submitted while production metrics remain Applied', () => {
    expect(labels).toContain("submitted: 'Applied'")
    expect(dashboard).toContain('label="Applied"')
    expect(caseWorkspace).toContain("formatCaseStageLabel")
    expect(source('crm/production/boardView.ts')).toContain("stage: 'submitted', label: 'Submitted'")
    expect(source('crm/households/ClientWorkspace/tabs/CasesTab.tsx')).toContain('Submitted {row.submitted}')
  })

  it('keeps household Cases and Open Cases on the same Case definition and Production detail path', () => {
    expect(casesTab).toContain('partitionHouseholdCases')
    expect(casesTab).toContain('crmProductionPath(row.id)')
    expect(casesTab).toContain('Open case workspace')
    expect(openCasesWidget).toContain('workspace.openCasesCount')
    expect(openCasesWidget).toContain('Open Cases')
    expect(casesTab).not.toMatch(/from\('cases'\)/)
  })

  it('does not modify Opportunity conversion', () => {
    expect(convertApi).toContain("export const CONVERT_OPPORTUNITY_RPC = 'convert_opportunity_to_policy_application'")
    expect(convertView).toContain('opportunityAllowsCreateCase')
    expect(queuePage).not.toContain('convert_opportunity_to_policy_application')
    expect(casesTab).not.toContain('convert_opportunity_to_policy_application')
  })
})
