import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLIENT_WORKSPACE_QUICK_ACTIONS } from '../households/ClientWorkspace/tabConfig'
import { PIPELINE_VIEWS } from './pipelineView'
import { OPPORTUNITY_LIST_DEFAULT_LIMIT } from './opportunitiesApi'
import { WORKSPACE_PREVIEW_LIMITS } from '../households/householdsApi'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')
const page = readFileSync(join(root, 'pages/crm/CrmOpportunitiesPage.tsx'), 'utf8')
const card = readFileSync(join(root, 'crm/opportunities/OpportunityPipelineCard.tsx'), 'utf8')
const view = readFileSync(join(root, 'crm/opportunities/pipelineView.ts'), 'utf8')
const api = readFileSync(join(root, 'crm/opportunities/opportunitiesApi.ts'), 'utf8')
const workspace = readFileSync(join(root, 'pages/crm/CrmOpportunityWorkspacePage.tsx'), 'utf8')
const detail = readFileSync(join(root, 'pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const productionApi = readFileSync(join(root, 'crm/production/productionApi.ts'), 'utf8')
const householdsApi = readFileSync(join(root, 'crm/households/householdsApi.ts'), 'utf8')
const widget = readFileSync(
  join(root, 'crm/households/ClientWorkspace/widgets/CurrentOpportunitiesWidget.tsx'),
  'utf8',
)
const tabConfig = readFileSync(join(root, 'crm/households/ClientWorkspace/tabConfig.ts'), 'utf8')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const convertApi = readFileSync(join(root, 'crm/opportunities/convertOpportunityApi.ts'), 'utf8')

describe('Phase 3 Opportunity ↔ Case visibility contracts', () => {
  it('adds a derived Case created badge on Pipeline table and cards without Open Case', () => {
    expect(page).toContain('CaseCreatedBadge')
    expect(page).toContain('<th scope="col">Case</th>')
    expect(card).toContain('CaseCreatedBadge')
    expect(page).toContain('crmOpportunityPath')
    expect(card).toContain('crmOpportunityPath')
    expect(page).not.toContain('crmProductionPath')
    expect(card).not.toContain('crmProductionPath')
    expect(page).not.toContain('Open Case')
    expect(card).not.toContain('Open Case')
    expect(styles).toContain('.crm-case-created-badge')
    expect(styles).not.toMatch(/\.crm-case-created-badge[\s\S]{0,400}#8a3b12/)
  })

  it('loads Case linkage from a left embed on fetchOpportunities without inner-filtering unlinked rows', () => {
    expect(page).toContain('fetchOpportunities(supabase)')
    expect(page).not.toMatch(/fetchOpportunities\(supabase,\s*\{/)
    expect(api).toContain('OPPORTUNITY_LIST_DEFAULT_LIMIT = 100')
    expect(OPPORTUNITY_LIST_DEFAULT_LIMIT).toBe(100)
    expect(api).toContain('linked_applications:policy_applications!opportunity_id')
    expect(api).toContain('pickLiveLinkedApplication')
    expect(api).not.toContain('policy_applications!inner')
    expect(api).not.toContain('linked_applications.deleted_at')
    const fetchStart = api.indexOf('export async function fetchOpportunities')
    const fetchEnd = api.indexOf('export async function fetchOpportunityById')
    expect(fetchStart).toBeGreaterThan(-1)
    expect(fetchEnd).toBeGreaterThan(fetchStart)
    expect(api.slice(fetchStart, fetchEnd)).not.toContain('fetchOpportunityLinkedApplication')
    expect(page).not.toContain('fetchOpportunityLinkedApplication')
  })

  it('does not add Case filter chips or a new Pipeline view', () => {
    expect(PIPELINE_VIEWS).toEqual(['active', 'mine', 'attention', 'won', 'lost'])
    expect(view).not.toContain('case_created')
    expect(view).not.toContain('no_case')
    expect(page).not.toContain('No Case Yet')
    expect(page).not.toContain('All Cases')
    expect(page).toContain('PipelineViewBar')
  })

  it('shows slim Household Current Opportunities linkage and Open Case only when linked', () => {
    expect(widget).toContain('CaseCreatedBadge')
    expect(widget).toContain('Open Opportunity')
    expect(widget).toContain('Open Case')
    expect(widget).toContain('liveCase')
    expect(widget).toContain('crmProductionPath(liveCase.applicationId)')
    expect(widget).not.toContain('ConvertOpportunityToCaseDialog')
    expect(widget).not.toContain('convert_opportunity_to_policy_application')
    expect(widget).not.toContain('ProductionApplicationDetail')
    expect(widget).not.toContain('expected_compensations')
    expect(widget).not.toContain('termination_reason')
    expect(householdsApi).toContain('attachLiveCasesToOpenOpportunities')
    expect(householdsApi).toContain('liveCaseFields(productionApplications)')
    expect(householdsApi).toContain("openOpportunities: 8")
    expect(householdsApi).toContain(".eq('status', 'open')")
    expect(WORKSPACE_PREVIEW_LIMITS.openOpportunities).toBe(8)
  })

  it('keeps Household Create Case disabled_future with no second conversion path', () => {
    expect(
      CLIENT_WORKSPACE_QUICK_ACTIONS.find((action) => action.id === 'create_case')?.availability,
    ).toBe('disabled_future')
    expect(tabConfig).toContain("id: 'create_case'")
    expect(tabConfig).toContain("availability: 'disabled_future'")
    expect(widget).not.toContain('create_policy_application')
  })

  it('keeps one primary Open Case on Opportunity Workspace and does not auto-Won', () => {
    expect(workspace.match(/Open Case/g)).toEqual(['Open Case'])
    expect(workspace).toContain('crm-opportunity-convert-open')
    expect(workspace).toContain('Linked Case')
    expect(workspace).toContain('linkedApplicationLabel')
    expect(workspace).not.toContain('status = \'won\'')
    expect(workspace).not.toContain('moveOpportunityStage(workspace.linkedApplication')
  })

  it('extends Case Detail linked Opportunity with vertical and advisor on the existing embed', () => {
    expect(productionApi).toContain('service_vertical:service_verticals!service_vertical_id ( name )')
    expect(productionApi).toContain(
      'assigned_advisor:advisor_profiles!assigned_advisor_id ( display_name )',
    )
    expect(detail).toContain('Open Opportunity')
    expect(detail).toContain('vertical_name')
    expect(detail).toContain('advisor_name')
    expect(detail).not.toContain('fetchOpportunityById')
    expect(detail).not.toContain('convert_opportunity_to_policy_application')
    const linkedStart = detail.indexOf('crm-production-linked-opportunity')
    const linkedEnd = detail.indexOf('pp-participants-heading')
    expect(linkedStart).toBeGreaterThan(-1)
    expect(linkedEnd).toBeGreaterThan(linkedStart)
    const linkedBlock = detail.slice(linkedStart, linkedEnd)
    expect(linkedBlock).toContain('Primary Product / Service')
    expect(linkedBlock).toContain('Assigned advisor')
    expect(linkedBlock).not.toContain('termination_reason')
    expect(linkedBlock).not.toContain('expected_compensations')
    expect(linkedBlock).not.toContain('fetchLiveExpectedCompensations')
  })

  it('keeps 393px stacking and 44px Household Case/Opportunity actions', () => {
    expect(styles).toContain('@media (max-width: 393px)')
    expect(styles).toContain('.crm-household-opportunity-action')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('.crm-household-opportunity-actions')
    expect(styles).toContain('flex-direction: column')
    expect(styles).toContain('.crm-production-linked-opportunity')
    expect(styles).toContain('.crm-opportunities-page')
    expect(styles).toContain('overflow-x: clip')
  })

  it('does not add Migration 047, commissions, production stage sync, or a new mutation path', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(50)
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('051_'))).toEqual([])
    expect(page).not.toContain('SERVICE_ROLE')
    expect(widget).not.toContain('SERVICE_ROLE')
    expect(page).not.toContain('createTask')
    expect(page).not.toContain('record_crm_activity')
    expect(page).not.toContain('transition_policy_application_stage')
    expect(convertApi).toContain("rpc(CONVERT_OPPORTUNITY_RPC")
    expect(page).not.toContain('convert_opportunity_to_policy_application')
    expect(card).not.toContain('commission')
    expect(view).not.toContain('writing_receivable_expected')
  })
})
