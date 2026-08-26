import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { isOperationalPolicyCase } from '../production/caseWorkspace'
import {
  APPLICATION_STARTED_SUCCESS_COPY,
  CONVERSION_ELIGIBLE_STATUSES,
  CONVERSION_ELIGIBLE_VERTICAL_CODES,
  formatOpportunityApplicationHandoffLabel,
  OPEN_APPLICATION_ACTION_LABEL,
  START_APPLICATION_ACTION_LABEL,
  START_APPLICATION_DIALOG_COPY,
} from './convertOpportunityView'
import { CONVERT_OPPORTUNITY_RPC } from './convertOpportunityApi'

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

describe('Opportunity → application handoff Phase B contracts', () => {
  const workspace = source('pages/crm/CrmOpportunityWorkspacePage.tsx')
  const dialog = source('crm/opportunities/ConvertOpportunityToCaseDialog.tsx')
  const api = source('crm/opportunities/convertOpportunityApi.ts')
  const badge = source('crm/opportunities/CaseCreatedBadge.tsx')
  const sql046 = source('supabase/migrations/046_opportunity_case_conversion.sql')
  const productionNew = source('pages/crm/CrmProductionNewPage.tsx')
  const appRoutes = source('src/App.tsx')
  const caseWorkspace = source('crm/production/caseWorkspace.ts')

  it('uses Start Application / Application Started wording without calling draft a Case', () => {
    expect(START_APPLICATION_ACTION_LABEL).toBe('Start Application')
    expect(OPEN_APPLICATION_ACTION_LABEL).toBe('Open Application')
    expect(APPLICATION_STARTED_SUCCESS_COPY).toBe('Application started.')
    expect(workspace).toContain('Start Application')
    expect(dialog).toContain('Start Application')
    expect(workspace).toContain('APPLICATION_STARTED_SUCCESS_COPY')
    expect(START_APPLICATION_DIALOG_COPY).toContain('draft application linked to this Opportunity')
    expect(START_APPLICATION_DIALOG_COPY).toContain('active Case after submission')
    expect(formatOpportunityApplicationHandoffLabel('draft')).toBe('Application Started')
    expect(formatOpportunityApplicationHandoffLabel('pre_submitted')).toBe('Application Started')
    expect(formatOpportunityApplicationHandoffLabel('draft')).not.toBe('Case Active')
    expect(badge).toContain('formatOpportunityApplicationHandoffLabel')
  })

  it('labels submitted+ as Case Active and suppresses a second Start Application when linked', () => {
    expect(formatOpportunityApplicationHandoffLabel('submitted')).toBe('Case Active')
    expect(workspace).toContain('workspace.linkedApplication ?')
    expect(workspace).toContain('Open Application')
    expect(workspace).toContain('crmProductionPath(workspace.linkedApplication.id)')
    expect(workspace).toContain('opportunityAllowsCreateCase(workspace.opportunity)')
    expect(workspace.indexOf('linkedApplication')).toBeLessThan(workspace.indexOf('Start Application'))
  })

  it('keeps conversion RPC, Migration 046 uniqueness, and eligibility unchanged', () => {
    expect(CONVERT_OPPORTUNITY_RPC).toBe('convert_opportunity_to_policy_application')
    expect(api).toContain("rpc(CONVERT_OPPORTUNITY_RPC")
    expect(api).not.toMatch(/rpc\(['"]create_policy_application/)
    expect(sha256('supabase/migrations/046_opportunity_case_conversion.sql')).toBe(SHA_046)
    expect(sql046).toContain('policy_applications_live_opportunity_unique_idx')
    expect(CONVERSION_ELIGIBLE_VERTICAL_CODES).toEqual(['life', 'retirement'])
    expect(CONVERSION_ELIGIBLE_STATUSES).toEqual(['open', 'on_hold', 'won'])
    expect(sql046).toContain("v_vertical_code NOT IN ('life', 'retirement')")
  })

  it('does not auto-submit, auto-Won, write commissions, or auto-create requirements', () => {
    expect(sql046).not.toContain('transition_policy_application_stage')
    expect(sql046).toContain("'created', false")
    expect(sql046).toContain('Never move won/on_hold')
    expect(api).not.toContain('transition_policy_application_stage')
    expect(dialog).not.toContain('submission_date')
    expect(dialog).not.toContain('writing_receivable_expected')
    expect(api).not.toContain('pp_refresh_application_expected_compensation')
    expect(api).not.toContain('createPolicyApplicationRequirement')
    expect(dialog).not.toContain('createPolicyApplicationRequirement')
    expect(workspace).not.toContain("status = 'won'")
  })

  it('does not add Opportunity linkage to Production New Application', () => {
    expect(productionNew).not.toContain('convert_opportunity_to_policy_application')
    expect(productionNew).not.toContain('ConvertOpportunityToCaseDialog')
    expect(productionNew).toContain('submitProductionApplication')
    expect(appRoutes).not.toContain('path="opportunities/:opportunityId/convert"')
    expect(existsSync(join(root, 'pages/crm/CrmOpportunityConvertPage.tsx'))).toBe(false)
  })

  it('keeps Phase A Case definition, no Migration 053, and credit_repair disabled', () => {
    expect(isOperationalPolicyCase({ production_stage: 'draft', submission_date: '2026-06-15' })).toBe(
      false,
    )
    expect(
      isOperationalPolicyCase({ production_stage: 'submitted', submission_date: '2026-06-15' }),
    ).toBe(true)
    expect(caseWorkspace).toContain('isLegitimateSubmittedApplication')
    expect(readdirSync(migrationsDir).filter((name) => name.startsWith('053_'))).toEqual([])
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })
})
