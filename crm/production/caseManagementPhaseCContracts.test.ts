import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import {
  START_APPLICATION_ACTION_LABEL,
  formatOpportunityApplicationHandoffLabel,
} from '../opportunities/convertOpportunityView'
import { computeDaysInStage } from './daysInStage'
import { isOperationalPolicyCase } from './caseWorkspace'

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

describe('Life & Annuity Case Management Phase C contracts', () => {
  const nextAction = source('crm/production/caseNextAction.ts')
  const detail = source('pages/crm/CrmProductionDetailPage.tsx')
  const requirements = source('crm/production/RequirementSection.tsx')
  const queuePage = source('pages/crm/CrmProductionPage.tsx')
  const queueTable = source('crm/production/ProductionQueueTable.tsx')
  const queueCards = source('crm/production/ProductionQueueCards.tsx')
  const boardCard = source('crm/production/ProductionBoardCard.tsx')
  const casesTab = source('crm/households/ClientWorkspace/tabs/CasesTab.tsx')
  const householdView = source('crm/production/householdCasesView.ts')
  const convertApi = source('crm/opportunities/convertOpportunityApi.ts')
  const daysInStage = source('crm/production/daysInStage.ts')
  const caseWorkspace = source('crm/production/caseWorkspace.ts')
  const compensationApi = source('crm/production/compensationApi.ts')
  const appRoutes = source('src/App.tsx')
  const routes = source('constants/routes.ts')

  it('does not add a second Case model, status system, or Migration 053', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(54)
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '053_case_management.sql'))).toBe(false)
    expect(nextAction).not.toMatch(/case_status|case_substatus|workflow_status/)
    expect(nextAction).toContain('Does not persist a next_action field')
    expect(caseWorkspace).toContain('No public.cases table')
    expect(appRoutes).not.toMatch(/path=["']cases["']/)
    expect(routes).not.toContain('/crm/cases')
    expect(detail).not.toContain('/crm/cases')
  })

  it('keeps migrations 046–052 byte-identical and credit_repair disabled', () => {
    expect(sha256('supabase/migrations/046_opportunity_case_conversion.sql')).toBe(SHA_046)
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })

  it('keeps the operational Case definition and excludes draft/pre_submitted', () => {
    expect(isOperationalPolicyCase({ production_stage: 'draft', submission_date: '2026-06-15' })).toBe(
      false,
    )
    expect(
      isOperationalPolicyCase({ production_stage: 'submitted', submission_date: '2026-06-15' }),
    ).toBe(true)
    expect(
      isOperationalPolicyCase({ production_stage: 'declined', submission_date: '2026-06-15' }),
    ).toBe(true)
    expect(nextAction).toContain('not_a_case')
    expect(nextAction).toContain('closed')
  })

  it('reuses existing days-in-stage, follow-up, and requirement helpers', () => {
    expect(daysInStage).toContain('export function computeDaysInStage')
    expect(daysInStage).toContain('export function followUpState')
    expect(detail).toContain('computeDaysInStage')
    expect(detail).toContain('formatDaysInStageLabel')
    expect(requirements).toContain('partitionRequirementRows')
    expect(requirements).toContain('No outstanding requirements.')
    expect(nextAction).not.toContain('next_action_due_at')
  })

  it('keeps list/board/household on shared next-action and attention helpers without a second query', () => {
    expect(queueTable).toContain('deriveCaseNextAction')
    expect(queueCards).toContain('deriveCaseNextAction')
    expect(boardCard).toContain('deriveCaseNextAction')
    expect(householdView).toContain('deriveCaseNextAction')
    expect(casesTab).toContain('crmProductionPath(row.id)')
    expect(queuePage).toContain('fetchOverdueRequirementCountsByApplicationIds(supabase, applicationIds)')
    expect(queuePage).not.toContain('fetchApplicationRequirements')
    expect(boardCard).not.toContain('fetchApplicationRequirements')
    expect(casesTab).not.toContain('fetchApplicationRequirements')
  })

  it('freezes Opportunity Phase B wording and conversion RPC', () => {
    expect(START_APPLICATION_ACTION_LABEL).toBe('Start Application')
    expect(formatOpportunityApplicationHandoffLabel('draft')).toBe('Application Started')
    expect(formatOpportunityApplicationHandoffLabel('submitted')).toBe('Case Active')
    expect(formatOpportunityApplicationHandoffLabel(null)).toBe('Application Linked')
    expect(convertApi).toContain("export const CONVERT_OPPORTUNITY_RPC = 'convert_opportunity_to_policy_application'")
    expect(nextAction).not.toContain('convert_opportunity_to_policy_application')
    expect(detail).not.toContain('Start Application')
  })

  it('does not broaden RLS, use a service-role browser client, or write commissions', () => {
    expect(detail).not.toContain('SERVICE_ROLE')
    expect(requirements).not.toContain('SERVICE_ROLE')
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(compensationApi).not.toMatch(/\.insert\s*\(/)
    expect(detail).toContain('<ExpectedCompensationPanel')
    expect(detail.indexOf('<ExpectedCompensationPanel')).toBeGreaterThan(
      detail.indexOf('<StageTransitionPanel'),
    )
    expect(computeDaysInStage({
      productionStage: 'submitted',
      stageHistory: [],
      updatedAt: '2026-08-01T00:00:00.000Z',
      now: new Date('2026-08-13T00:00:00.000Z'),
    }).days).toBe(12)
  })
})
