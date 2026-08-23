import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')
const page = readFileSync(join(root, 'pages/crm/CrmOpportunitiesPage.tsx'), 'utf8')
const workspace = readFileSync(join(root, 'pages/crm/CrmOpportunityWorkspacePage.tsx'), 'utf8')
const card = readFileSync(join(root, 'crm/opportunities/OpportunityPipelineCard.tsx'), 'utf8')
const view = readFileSync(join(root, 'crm/opportunities/pipelineView.ts'), 'utf8')
const api = readFileSync(join(root, 'crm/opportunities/opportunitiesApi.ts'), 'utf8')
const widget = readFileSync(
  join(root, 'crm/households/ClientWorkspace/widgets/CurrentOpportunitiesWidget.tsx'),
  'utf8',
)
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const catalog = readFileSync(join(root, 'platform/registry/catalog.ts'), 'utf8')

describe('Phase 1 pipeline visibility contracts', () => {
  it('does not add a pipeline-card migration; 046 is opportunity conversion only', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(47)
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '045_opportunities.sql'))).toBe(false)
  })

  it('keeps the existing /crm/pipeline route and workspace path', () => {
    expect(app).toContain('path="pipeline"')
    expect(app).toContain('CrmOpportunitiesPage')
    expect(app).toContain('path="opportunities/:opportunityId"')
    expect(catalog).toContain("route: '/crm/pipeline'")
    expect(page).toContain('crmOpportunityPath')
    expect(card).toContain('crmOpportunityPath')
    expect(page).not.toContain('path="/crm/opportunities"')
  })

  it('reuses fetchOpportunities and move_opportunity_stage without a parallel API', () => {
    expect(page).toContain('fetchOpportunities(supabase)')
    expect(page).toContain('fetchCurrentAdvisorProfileId')
    expect(workspace).toContain('OpportunityLifecycleDialog')
    expect(api).toContain("rpc('move_opportunity_stage'")
    expect(page).not.toMatch(/from\('opportunities'\)[\s\S]*\.update\(/)
    expect(workspace).not.toMatch(/from\('opportunities'\)[\s\S]*\.update\(/)
    expect(view).not.toContain('assign_opportunity')
    expect(page).not.toContain('assign_opportunity')
  })

  it('does not create tasks, activities, conversion, or Case follow-up coupling', () => {
    expect(page).not.toContain('createTask')
    expect(page).not.toContain('record_crm_activity')
    expect(view).not.toContain('next_follow_up_date')
    expect(card).not.toContain('next_follow_up_date')
    expect(page).not.toContain('create_policy_application')
    expect(view).not.toContain('expected_compensation')
    expect(card).not.toContain('commission')
    expect(card).not.toContain('raw_payload')
  })

  it('prioritizes household, primary product, stage, advisor, next action, due, attention', () => {
    const householdAt = card.indexOf('copy.householdName')
    const productAt = card.indexOf('copy.primaryProduct')
    const stageAt = card.indexOf('copy.stage')
    const flagsAt = card.lastIndexOf('OpportunityAttentionFlagList')
    const advisorAt = card.indexOf('<dt>Advisor</dt>')
    const actionAt = card.indexOf('<dt>Next action</dt>')
    const dueAt = card.indexOf('<dt>Due</dt>')
    expect(householdAt).toBeGreaterThan(-1)
    expect(productAt).toBeGreaterThan(householdAt)
    expect(stageAt).toBeGreaterThan(productAt)
    expect(flagsAt).toBeGreaterThan(stageAt)
    expect(advisorAt).toBeGreaterThan(flagsAt)
    expect(actionAt).toBeGreaterThan(advisorAt)
    expect(dueAt).toBeGreaterThan(actionAt)
    expect(view).toContain('getOpportunityVerticalLabel')
    expect(view).toContain('Overdue next action')
    expect(view).toContain('isStaleOpportunity')
  })

  it('keeps desktop table and mobile cards, with 44px chips that can scroll', () => {
    expect(page).toContain('crm-opportunities-table')
    expect(page).toContain('OpportunityPipelineCard')
    expect(page).toContain('PipelineViewBar')
    expect(styles).toContain('.crm-pipeline-view-bar')
    expect(styles).toContain('.crm-pipeline-view-btn')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('overflow-x: auto')
    expect(styles).toContain('overflow-wrap: anywhere')
    expect(styles).toContain('.crm-opportunities-page')
    expect(styles).toContain('overflow-x: clip')
  })

  it('aligns workspace terminology without replacing the lifecycle RPC', () => {
    expect(workspace).toContain('← Pipeline')
    expect(workspace).toContain('Primary Product / Service')
    expect(workspace).toContain('Next-action due')
    expect(workspace).toContain('Advisor')
    expect(workspace).toContain('OpportunityLifecycleDialog')
    expect(workspace).toContain('Close as Won')
    expect(workspace).toContain('Close as Lost')
    expect(readFileSync(join(root, 'crm/opportunities/OpportunityLifecycleDialog.tsx'), 'utf8')).toContain(
      'moveOpportunityStage',
    )
    expect(widget).toContain('Current Opportunities')
    expect(widget).toContain('crmOpportunityPath')
  })

  it('does not weaken browser security boundaries', () => {
    expect(page).not.toContain('SERVICE_ROLE')
    expect(workspace).not.toContain('SERVICE_ROLE')
    expect(api).not.toContain('SERVICE_ROLE')
    expect(view).not.toContain('crm_can_access_opportunity')
    expect(page).not.toContain('/api/opportunities')
  })
})
