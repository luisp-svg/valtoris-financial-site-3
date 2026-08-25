import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { EXPECTED_NUMBERED_MIGRATIONS } from '../security/migration045Contract'
import {
  CREDIT_REPAIR_PIPELINE_ID,
  CREDIT_REPAIR_VERTICAL_ID,
  STUDENT_LOANS_PIPELINE_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from '../security/migration047Contract'
import { OPPORTUNITY_INSERT_ALLOWLIST } from '../opportunities/opportunitiesApi'

const root = resolve(process.cwd())
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

const page = read('pages/crm/CrmIntakePage.tsx')
const panel = read('crm/intake/IntakeDetailPanel.tsx')
const assignDialog = read('crm/intake/IntakeAssignAdvisorDialog.tsx')
const assignWrapper = read('crm/intake/intakeAssignment.ts')
const assignUi = read('crm/intake/intakeAssignmentUi.ts')
const prefill = read('crm/intake/intakeOpportunityPrefill.ts')
const opportunityUi = read('crm/intake/intakeOpportunityUi.ts')
const form = read('crm/opportunities/OpportunityFormDialog.tsx')
const opportunitiesApi = read('crm/opportunities/opportunitiesApi.ts')
const archiveWrapper = read('crm/intake/intakeArchive.ts')
const familyIngest = read('server/ingest/familyReportCard/ingestFamilyReportCard.ts')
const catalog = read('platform/registry/catalog.ts')
const convertView = read('crm/opportunities/convertOpportunityView.ts')
const pipelinePage = read('pages/crm/CrmOpportunitiesPage.tsx')
const householdWidget = read('crm/households/ClientWorkspace/widgets/CurrentOpportunitiesWidget.tsx')
const householdsApi = read('crm/households/householdsApi.ts')

describe('Intake Phase 2 assignment contracts', () => {
  it('reuses assign_household and the existing advisor catalog fetcher', () => {
    expect(page).toContain('assignIntakeHousehold(supabase, {')
    expect(page).toContain('householdId: selectedItem.household.id')
    expect(page).toContain('IntakeAssignAdvisorDialog')
    expect(assignWrapper).toContain("supabase.rpc(INTAKE_ASSIGN_HOUSEHOLD_RPC, {")
    expect(assignWrapper).toContain('p_household_id: input.householdId')
    expect(assignWrapper).toContain('p_advisor_id: input.advisorId')
    expect(assignWrapper).toContain("p_reason: 'manual'")
    expect(assignDialog).toContain('fetchOpportunityAdvisorOptions')
    expect(assignDialog).not.toContain('contract_level')
    expect(assignDialog).not.toContain('SERVICE_ROLE')
    expect(assignUi).toContain('return input.isOwner && Boolean(input.householdId)')
    expect(panel).toContain('INTAKE_ASSIGN_ADVISOR_ACTION_LABEL')
    expect(panel).toContain('canPresentAssignAdvisor')
  })

  it('does not update assignment tables or Activity from the browser', () => {
    expect(assignWrapper).not.toContain('.from(')
    expect(assignWrapper).not.toContain("from('households')")
    expect(assignWrapper).not.toContain("from('activities')")
    expect(assignWrapper).not.toContain('record_crm_activity')
    expect(page).not.toContain("from('households')")
    expect(page).not.toContain("from('advisor_profiles')")
    expect(page).not.toContain("from('activities')")
    expect(page).not.toContain('.update(')
    expect(assignDialog).not.toContain("from('activities')")
    expect(assignWrapper).not.toContain('createOpportunity')
    expect(assignWrapper).not.toContain('deleted_at')
  })

  it('refreshes Intake after assignment and does not archive', () => {
    expect(page).toContain('setReloadToken((token) => token + 1)')
    expect(page).toContain('INTAKE_ASSIGN_SUCCESS_COPY')
    const assignHandler = page.slice(
      page.indexOf('async function handleConfirmAssign'),
      page.indexOf('function handleOpportunityCreated'),
    )
    expect(assignHandler).not.toContain('archiveIntakeLead')
    expect(assignHandler).not.toContain('createOpportunity')
  })
})

describe('Intake Phase 2 Opportunity contracts', () => {
  it('reuses OpportunityFormDialog with household locked and safe prefills', () => {
    expect(page).toContain('import OpportunityFormDialog from')
    expect(page).toContain('defaultHouseholdId={opportunityPrefill.householdId}')
    expect(page).toContain('defaultHouseholdLabel={opportunityPrefill.householdLabel}')
    expect(page).toContain('defaultTitle={opportunityPrefill.title}')
    expect(page).toContain('defaultServiceVerticalId={opportunityPrefill.serviceVerticalId}')
    expect(page).toContain('defaultAssignedAdvisorId={opportunityPrefill.assignedAdvisorId}')
    expect(form).toContain('householdLocked = Boolean(defaultHouseholdId)')
    expect(form).toContain('defaultServiceVerticalId')
    expect(form).toContain('createOpportunity')
    expect(form).not.toContain('source_lead_id')
    expect(form).not.toContain('credit_repair')
    expect(form).not.toContain('student_loans')
    expect(panel).toContain('INTAKE_CREATE_OPPORTUNITY_ACTION_LABEL')
  })

  it('omits source_lead_id in V1 and does not auto-archive', () => {
    expect(OPPORTUNITY_INSERT_ALLOWLIST).not.toContain('source_lead_id')
    expect(prefill).toContain('includeSourceLeadId: false')
    expect(opportunitiesApi).toContain("'source_lead_id'")
    const createHandler = page.slice(page.indexOf('function handleOpportunityCreated'))
    expect(createHandler).toContain('INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY')
    expect(createHandler).toContain('crmOpportunityPath')
    expect(createHandler).not.toContain('archiveIntakeLead')
    expect(createHandler).not.toContain('deleted_at')
    expect(page).toContain('Open Opportunity')
  })

  it('maps Student Loan and Credit Intake only as suggestions', () => {
    expect(prefill).toContain("leadType === 'Student Loan Report Card'")
    expect(prefill).toContain('STUDENT_LOANS_VERTICAL_ID')
    expect(prefill).toContain("leadType === 'Credit Report Card'")
    expect(prefill).toContain('CREDIT_REPAIR_VERTICAL_ID')
    expect(prefill).toContain('return null')
    expect(CREDIT_REPAIR_VERTICAL_ID).toBe('11111111-1111-1111-1111-111111111105')
    expect(STUDENT_LOANS_VERTICAL_ID).toBe('11111111-1111-1111-1111-111111111106')
    expect(CREDIT_REPAIR_PIPELINE_ID).toBe('22222222-2222-2222-2222-222222222215')
    expect(STUDENT_LOANS_PIPELINE_ID).toBe('22222222-2222-2222-2222-222222222216')
  })

  it('keeps unassigned-pool advisors from creating Opportunities on Intake-only households', () => {
    expect(opportunityUi).toContain('crm_can_access_household')
    expect(opportunityUi).toContain(
      'input.currentAdvisorProfileId === input.householdAssignedAdvisorId',
    )
    expect(opportunityUi).not.toContain('crm_advisors_can_view_unassigned')
  })

  it('uses existing Pipeline and Household Current Opportunities surfaces', () => {
    expect(pipelinePage).toContain('fetchOpportunities(supabase)')
    expect(householdWidget).toContain('Current Opportunities')
    expect(householdsApi).toContain('fetchOpenOpportunitiesForHousehold')
    expect(page).not.toContain('fetchIntakeOpportunities')
  })
})

describe('Intake Phase 2 isolation', () => {
  it('does not auto-create Opportunities from public Report Card ingest', () => {
    expect(familyIngest).toContain('export async function ingestPublicReportCard')
    expect(familyIngest).not.toContain('createOpportunity')
    expect(familyIngest).not.toContain("from('opportunities')")
    expect(familyIngest).not.toContain('assign_household')
  })

  it('keeps legacy credit_repair servicing disabled', () => {
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('credit_repair_case')
    expect(convertView).not.toContain('credit_repair')
    expect(page).not.toContain('credit_repair_case')
    expect(page).not.toContain('dispute')
  })

  it('leaves archive as a separate action and does not alter the archive RPC wrapper', () => {
    expect(archiveWrapper).toContain("supabase.rpc(INTAKE_ARCHIVE_RPC, {")
    expect(panel).toContain('INTAKE_ARCHIVE_ACTION_LABEL')
    expect(panel).toContain('crm-intake-action-secondary')
    expect(page).toContain('handleConfirmArchive')
  })

  it('leaves migrations 047–052 unchanged and does not add 053', () => {
    const migrationsDir = resolve(root, 'supabase/migrations')
    const files = readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .sort()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual([])
    expect(existsSync(resolve(migrationsDir, '053_intake_opportunity.sql'))).toBe(false)
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
  })
})
