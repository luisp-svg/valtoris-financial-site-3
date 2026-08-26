import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import {
  CONVERSION_ELIGIBLE_VERTICAL_CODES,
  conversionProductLinesForVertical,
  opportunityAllowsCreateCase,
} from './convertOpportunityView'
import { PIPELINE_VIEWS } from './pipelineView'
import { MIGRATION_047_FILENAME } from '../security/migration047Contract'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')
const sql047 = readFileSync(join(migrationsDir, MIGRATION_047_FILENAME), 'utf8')
const sql046 = readFileSync(join(migrationsDir, '046_opportunity_case_conversion.sql'), 'utf8')
const form = readFileSync(join(here, 'OpportunityFormDialog.tsx'), 'utf8')
const api = readFileSync(join(here, 'opportunitiesApi.ts'), 'utf8')
const page = readFileSync(join(root, 'pages/crm/CrmOpportunitiesPage.tsx'), 'utf8')
const workspace = readFileSync(join(root, 'pages/crm/CrmOpportunityWorkspacePage.tsx'), 'utf8')
const widget = readFileSync(
  join(root, 'crm/households/ClientWorkspace/widgets/CurrentOpportunitiesWidget.tsx'),
  'utf8',
)
const tabConfig = readFileSync(join(root, 'crm/households/ClientWorkspace/tabConfig.ts'), 'utf8')
const casesTab = readFileSync(join(root, 'crm/households/ClientWorkspace/tabs/CasesTab.tsx'), 'utf8')
const policiesTab = readFileSync(
  join(root, 'crm/households/ClientWorkspace/tabs/PoliciesTab.tsx'),
  'utf8',
)
const householdsApi = readFileSync(join(root, 'crm/households/householdsApi.ts'), 'utf8')
const convertView = readFileSync(join(here, 'convertOpportunityView.ts'), 'utf8')
const pipelineView = readFileSync(join(here, 'pipelineView.ts'), 'utf8')
const catalog = readFileSync(join(root, 'platform/registry/catalog.ts'), 'utf8')

describe('credit repair / student loan sales catalog contracts', () => {
  it('keeps 047 data-only and allows only the 048 ingest enablement file', () => {
    const files = readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .sort()
    expect(files).toHaveLength(52)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '048_service_cases.sql'))).toBe(false)
    expect(sql047).not.toContain('CREATE TABLE')
    expect(sql047).not.toContain('ALTER TABLE')
    expect(sql047).not.toContain('service_cases')
    expect(sql047).not.toContain('service_revenue_events')
    expect(sql047).not.toMatch(/enroll/i)
  })

  it('keeps Opportunity create on database catalogs with no duplicated vertical lists', () => {
    expect(form).toContain('fetchOpportunityServiceVerticalOptions')
    expect(form).toContain('fetchOpportunityPipelineOptions')
    expect(form).toContain('fetchOpportunityStageOptionsForPipelines')
    expect(form).not.toContain('credit_repair')
    expect(form).not.toContain('student_loans')
    expect(api).toContain(".from('service_verticals')")
    expect(api).toContain(".from('pipelines')")
    expect(api).toContain(".from('pipeline_stages')")
    expect(workspace).toContain('Primary Product / Service')
  })

  it('blocks insurance Case conversion for the new sales verticals and leaves Life/FIA unchanged', () => {
    expect(CONVERSION_ELIGIBLE_VERTICAL_CODES).toEqual(['life', 'retirement'])
    expect(conversionProductLinesForVertical('life')).toEqual(['life_term', 'life_permanent'])
    expect(conversionProductLinesForVertical('retirement')).toEqual(['fia'])
    expect(conversionProductLinesForVertical('credit_repair')).toEqual([])
    expect(conversionProductLinesForVertical('student_loans')).toEqual([])
    expect(
      opportunityAllowsCreateCase({ status: 'open', service_vertical: { code: 'credit_repair' } }),
    ).toBe(false)
    expect(
      opportunityAllowsCreateCase({ status: 'won', service_vertical: { code: 'student_loans' } }),
    ).toBe(false)
    expect(sql046).toContain("v_vertical_code NOT IN ('life', 'retirement')")
    expect(convertView).not.toContain('credit_repair')
    expect(convertView).not.toContain('student_loans')
  })

  it('keeps Household Opportunities generic and does not add a Services tab', () => {
    expect(widget).toContain('Current Opportunities')
    expect(widget).toContain('getOpportunityVerticalLabel')
    expect(widget).not.toContain('credit_repair')
    expect(widget).not.toContain('student_loans')
    expect(householdsApi).toContain('fetchOpenOpportunitiesForHousehold')
    expect(householdsApi).toContain('.eq(\'status\', \'open\')')
    expect(tabConfig).not.toMatch(/id: 'services'/)
    expect(tabConfig).toContain("{ id: 'policies', label: 'Policies', enabled: true }")
    expect(tabConfig).toContain("availability: 'disabled_future'")
    expect(casesTab).toContain('Policies tab')
    expect(policiesTab).toContain('fetchHouseholdPolicyBook')
    expect(policiesTab).toContain(
      'Policy records for this household, including issued, in force, canceled, surrendered, and',
    )
    expect(policiesTab).not.toContain('Policies linked to this household through Policy Production')
    expect(policiesTab).not.toContain('fetchHouseholdProductionApplications')
  })

  it('keeps Pipeline data-driven without new top-level chips or a second page', () => {
    expect(PIPELINE_VIEWS).toEqual(['active', 'mine', 'attention', 'won', 'lost'])
    expect(page).toContain('PipelineViewBar')
    expect(page).toContain('fetchOpportunities(supabase)')
    expect(pipelineView).not.toContain('credit_repair')
    expect(pipelineView).not.toContain('student_loans')
    expect(page).not.toContain('Credit Repair Pipeline')
    expect(page).not.toContain('Student Loans Pipeline')
  })

  it('does not wire policy, commission, or the disabled credit_repair platform module', () => {
    expect(sql047).not.toContain('policy_applications')
    expect(sql047).not.toContain('record_policy_writing_commission_event')
    expect(sql047).not.toContain('pp_refresh_application_expected_compensation')
    expect(sql047).not.toContain('Credit Repair Commission')
    expect(sql047).not.toContain('Student Loan Commission')
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(getModule('credit_repair')?.navigation.visible).toBe(false)
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('featureFlag: { enabled: false }')
  })
})
