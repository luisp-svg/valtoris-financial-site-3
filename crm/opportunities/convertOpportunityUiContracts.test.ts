import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLIENT_WORKSPACE_QUICK_ACTIONS } from '../households/ClientWorkspace/tabConfig'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const workspace = readFileSync(join(root, 'pages/crm/CrmOpportunityWorkspacePage.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'ConvertOpportunityToCaseDialog.tsx'), 'utf8')
const api = readFileSync(join(here, 'convertOpportunityApi.ts'), 'utf8')
const view = readFileSync(join(here, 'convertOpportunityView.ts'), 'utf8')
const detail = readFileSync(join(root, 'pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const sql = readFileSync(join(root, 'supabase/migrations/046_opportunity_case_conversion.sql'), 'utf8')

describe('opportunity case conversion UX contracts', () => {
  it('adds Start Application / Open Application on the existing Opportunity Workspace route only', () => {
    expect(workspace).toContain('Start Application')
    expect(workspace).toContain('Open Application')
    expect(workspace).toContain('APPLICATION_STARTED_SUCCESS_COPY')
    expect(workspace).toContain('ConvertOpportunityToCaseDialog')
    expect(workspace).toContain('opportunityAllowsCreateCase')
    expect(workspace).toContain('crmProductionPath')
    expect(workspace).not.toContain('Create Case')
    expect(workspace).not.toContain('Open Case')
    expect(workspace).not.toContain('navigate(crmProductionPath(result.applicationId))')
    expect(app).toContain('path="opportunities/:opportunityId"')
    expect(app).not.toContain('path="opportunities/:opportunityId/convert"')
    expect(existsSync(join(root, 'pages/crm/CrmOpportunityConvertPage.tsx'))).toBe(false)
  })

  it('keeps household Create Case disabled and does not add a second wizard there', () => {
    expect(
      CLIENT_WORKSPACE_QUICK_ACTIONS.find((action) => action.id === 'create_case')?.availability,
    ).toBe('disabled_future')
    const householdWidget = readFileSync(
      join(root, 'crm/households/ClientWorkspace/widgets/CurrentOpportunitiesWidget.tsx'),
      'utf8',
    )
    expect(householdWidget).not.toContain('ConvertOpportunityToCaseDialog')
    expect(householdWidget).not.toContain('convert_opportunity_to_policy_application')
  })

  it('uses a compact conversion wizard without New Application catch-up or historical import', () => {
    expect(dialog).toContain('Start Application')
    expect(dialog).toContain('START_APPLICATION_DIALOG_COPY')
    expect(view).toContain('draft application linked to this Opportunity')
    expect(view).toContain('active Case after submission')
    expect(view).toContain('does not mark the Opportunity Won')
    expect(dialog).not.toContain('Create Case')
    expect(dialog).toContain('Application state')
    expect(dialog).toContain('WritingAdvisorsFields')
    expect(dialog).toContain('suggestedWritingAllocations')
    expect(dialog).toContain('Do not assume the household primary contact')
    expect(dialog).toContain('if (submitting) return')
    expect(dialog).not.toContain('existing_business')
    expect(dialog).not.toContain('historical_entry')
    expect(dialog).not.toContain('writing_receivable_expected')
    expect(dialog).not.toContain('submission_date')
    expect(dialog).not.toContain('create_policy_application')
    expect(api).toContain("rpc(CONVERT_OPPORTUNITY_RPC")
    expect(api).not.toMatch(/rpc\(['"]create_policy_application/)
    expect(api).not.toContain('SERVICE_ROLE')
    expect(api).not.toMatch(/\.insert\s*\(/)
    expect(view).not.toContain('defaultRoleMembers')
  })

  it('replaces the Case Detail UUID with opportunity context and Open Opportunity', () => {
    expect(detail).toContain('Open Opportunity')
    expect(detail).toContain('linked_opportunity')
    expect(detail).toContain('formatOpportunityStatusLabel')
    expect(detail).toContain('vertical_name')
    expect(detail).toContain('advisor_name')
    expect(detail).toContain('Primary Product / Service')
    expect(detail).toContain('Assigned advisor')
    expect(detail).not.toMatch(/Linked opportunity:\s*\{\s*['"]/)
  })

  it('keeps the conversion wizard single-column and 44px at 393px', () => {
    expect(styles).toContain('.crm-opportunity-convert-overlay')
    expect(styles).toContain('.crm-opportunity-convert-dialog')
    expect(styles).toContain('@media (max-width: 393px)')
    expect(styles).toContain('.crm-opportunity-convert-actions .crm-primary-btn')
    expect(styles).toContain('min-height: 44px')
    expect(sql).toContain('convert_opportunity_to_policy_application')
  })
})
