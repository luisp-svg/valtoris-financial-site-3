import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCrmSidebarNavItems, getModule } from '../../platform/registry'
import { CRM_NAV_ITEMS } from '../nav'
import {
  START_APPLICATION_ACTION_LABEL,
  formatOpportunityApplicationHandoffLabel,
} from '../opportunities/convertOpportunityView'
import { isLegitimateSubmittedApplication } from '../production/productionMetrics'
import { isClosedPolicyCase, isOpenPolicyCase, isOperationalPolicyCase } from '../production/caseWorkspace'
import { isActiveHouseholdPolicy } from './activePolicyStatus'
import { crmHouseholdPoliciesPath, crmProductionPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')
const SHA_046 = '2d0cf7323638ae50c55c9eca65d957c1a48b3035a7bdef251f009961338020fb'
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

describe('Phase D2 Policy Handoff & Household Policy Cleanup contracts', () => {
  const api = source('crm/households/householdPoliciesApi.ts')
  const view = source('crm/households/householdPoliciesView.ts')
  const tab = source('crm/households/ClientWorkspace/tabs/PoliciesTab.tsx')
  const casesTab = source('crm/households/ClientWorkspace/tabs/CasesTab.tsx')
  const detail = source('pages/crm/CrmProductionDetailPage.tsx')
  const handoff = source('crm/production/policyHandoffView.ts')
  const appRoutes = source('src/App.tsx')
  const routes = source('constants/routes.ts')
  const client = source('lib/supabase/client.ts')
  const convertApi = source('crm/opportunities/convertOpportunityApi.ts')
  const caseWorkspace = source('crm/production/caseWorkspace.ts')
  const caseOps = source('crm/production/caseOperationsView.ts')
  const compensationApi = source('crm/production/compensationApi.ts')
  const activePolicy = source('crm/households/activePolicyStatus.ts')
  const attachFp = source('crm/households/ClientWorkspace/financialProgress/attachFinancialProgress.ts')
  const placeholder = source('pages/crm/CrmPlaceholderPage.tsx')

  it('loads Household Policies from public.policies, not policy_applications', () => {
    expect(api).toContain(".from('policies')")
    expect(api).toContain('.eq(\'household_id\', householdId)')
    expect(api).toContain('.is(\'deleted_at\', null)')
    expect(api).not.toContain(".from('policy_applications')")
    expect(api).not.toContain("from './activePolicyStatus'")
    expect(api).not.toMatch(/isActiveHouseholdPolicy\(/)
    expect(tab).toContain('fetchHouseholdPolicyBook')
    expect(tab).not.toContain('fetchHouseholdProductionApplications')
    expect(tab).not.toContain('mapHouseholdProductionPolicy')
    expect(tab).not.toContain('Active Policies')
    expect(tab).not.toContain('Legacy policy records')
    expect(tab).toContain('VIEW_CASE_LABEL')
  })

  it('batches writing allocations once by application id and never per row', () => {
    expect(api).toContain(".from('policy_agent_allocations')")
    expect(api).toContain(".in('application_id', ids)")
    expect(api).toContain(".is('effective_to', null)")
    expect(api).not.toMatch(/for\s*\(.*sourceApplicationId/)
    expect(api).not.toContain('.eq(\'application_id\', policy')
    expect(view).toContain('formatHouseholdPolicyWriters')
    expect(view).not.toContain('servicingAdvisorId')
    expect(view).not.toContain("from './activePolicyStatus'")
  })

  it('keeps Case definition, operations, and conversion frozen', () => {
    expect(isOperationalPolicyCase({ production_stage: 'draft', submission_date: '2026-06-15' })).toBe(
      false,
    )
    expect(
      isLegitimateSubmittedApplication({
        production_stage: 'submitted',
        submission_date: '2026-06-15',
      }),
    ).toBe(true)
    expect(isOpenPolicyCase({ production_stage: 'issued', submission_date: '2026-06-15' })).toBe(true)
    expect(isClosedPolicyCase({ production_stage: 'not_taken', submission_date: '2026-06-15' })).toBe(
      true,
    )
    expect(isClosedPolicyCase({ production_stage: 'in_force', submission_date: '2026-06-15' })).toBe(
      true,
    )
    expect(caseWorkspace).toContain('isLegitimateSubmittedApplication')
    expect(caseOps).toContain('CASE_OPERATIONS_PAYLOAD_KEYS')
    expect(convertApi).toContain("export const CONVERT_OPPORTUNITY_RPC = 'convert_opportunity_to_policy_application'")
    expect(START_APPLICATION_ACTION_LABEL).toBe('Start Application')
    expect(formatOpportunityApplicationHandoffLabel('draft')).toBe('Application Started')
    expect(casesTab).toContain('fetchHouseholdProductionApplications')
    expect(casesTab).toContain('partitionHouseholdCases')
  })

  it('wires Case → Policy handoff to Household Policies, not /crm/policies/:id', () => {
    expect(detail).toContain('linkedPolicyHandoffModel')
    expect(detail).toContain('VIEW_IN_HOUSEHOLD_POLICIES_LABEL')
    expect(handoff).toContain('crmHouseholdPoliciesPath')
    expect(routes).toContain('?tab=policies')
    expect(crmHouseholdPoliciesPath('hh-1')).toBe('/crm/households/hh-1?tab=policies')
    expect(crmProductionPath('app-9')).toBe('/crm/production/app-9')
    expect(appRoutes).toContain('path="policies" element={<CrmPlaceholderPage />}')
    expect(appRoutes).not.toContain('policies/:')
    expect(routes).not.toContain('/crm/policies/:')
    expect(routes).toContain("crmPolicies: '/crm/policies'")
    expect(getCrmSidebarNavItems().some((item) => item.path === '/crm/policies')).toBe(false)
    expect(CRM_NAV_ITEMS.some((item) => item.path === '/crm/policies')).toBe(false)
    expect(placeholder).toContain('Coming next')
  })

  it('freezes issued → not_taken divergence without mutation', () => {
    expect(handoff).toContain("production_stage === 'not_taken'")
    expect(handoff).toContain("statusRaw?.toLowerCase() === 'issued'")
    expect(api).not.toContain('not_taken')
    expect(view).not.toContain('not_taken')
    expect(api).not.toMatch(/\.update\s*\(/)
    expect(api).not.toMatch(/\.rpc\s*\(/)
    expect(tab).not.toMatch(/\.rpc\s*\(/)
  })

  it('keeps active-protection KPI and Financial Progress semantics unchanged', () => {
    expect(isActiveHouseholdPolicy({ status: 'issued', source_application_id: 'app-1' })).toBe(false)
    expect(isActiveHouseholdPolicy({ status: 'in_force', source_application_id: 'app-1' })).toBe(true)
    expect(activePolicy).toContain('Linked production policies are active only while')
    expect(attachFp).toContain('workspace.financialProgressPolicies')
    expect(api).not.toContain("from './activePolicyStatus'")
    expect(api).not.toMatch(/isActiveHouseholdPolicy\(/)
  })

  it('does not broaden RLS, add Migration 053, or enable credit_repair', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(54)
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '053_policy_handoff.sql'))).toBe(false)
    expect(sha256('supabase/migrations/046_opportunity_case_conversion.sql')).toBe(SHA_046)
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(client).toContain('anon/publishable key + RLS')
    expect(client).not.toContain('SERVICE_ROLE')
    expect(api).not.toContain('SERVICE_ROLE')
    expect(tab).not.toContain('SERVICE_ROLE')
    expect(detail).not.toContain('SERVICE_ROLE')
    expect(compensationApi).toContain('pp_writing_commission_snapshot')
    expect(api).not.toContain('expected_compensation')
    expect(tab).not.toContain('fetchLiveExpectedCompensations')
  })
})
