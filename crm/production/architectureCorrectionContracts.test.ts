import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PRODUCTION_STAGES, PROPOSED_PRODUCTION_STAGES } from './types'

const here = dirname(fileURLToPath(import.meta.url))
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const entryForm = readFileSync(join(here, 'ApplicationEntryForm.tsx'), 'utf8')
const newPage = readFileSync(join(here, '../../pages/crm/CrmProductionNewPage.tsx'), 'utf8')
const quickAdd = readFileSync(join(here, '../contacts/QuickAddContactForm.tsx'), 'utf8')
const policiesTab = readFileSync(join(here, '../households/ClientWorkspace/tabs/PoliciesTab.tsx'), 'utf8')
const householdSummary = readFileSync(
  join(here, '../households/ClientWorkspace/widgets/HouseholdSummaryWidget.tsx'),
  'utf8',
)
const newClientDialog = readFileSync(join(here, 'NewClientFromApplicationDialog.tsx'), 'utf8')
const migrationsDir = join(here, '../../supabase/migrations')

describe('policy production + client architecture no-schema contracts', () => {
  it('adds + New Client from New Application using quick_add_contact and auto-selects the household', () => {
    expect(entryForm).toContain('+ New Client')
    expect(newPage).toContain('NewClientFromApplicationDialog')
    expect(newPage).toContain('onHouseholdReady')
    expect(newPage).toContain('setHouseholdId(nextHouseholdId)')
    expect(newClientDialog).toContain('QuickAddContactForm')
    expect(newClientDialog).toContain('embedded')
    expect(quickAdd).toContain('createManualContact')
    expect(quickAdd).toContain('else if (!embedded) navigate')
    expect(readFileSync(join(here, '../contacts/contactsApi.ts'), 'utf8')).toContain("rpc('quick_add_contact'")
    expect(newClientDialog).not.toMatch(/\.insert\s*\(/)
  })

  it('keeps production writes on approved RPCs and does not UPDATE production_stage from the browser', () => {
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.transition")
    expect(applicationApi).not.toMatch(/production_stage\s*:/)
    expect(applicationApi).not.toMatch(/\.update\s*\(/)
    expect(newPage).toContain('submitProductionApplication')
    expect(newPage).toContain('existing_business')
  })

  it('displays Applied while the RPC value remains submitted', () => {
    expect(entryForm).toContain('Applied')
    expect(applicationApi).toContain("toStage: stage")
    expect(applicationApi).toContain('catchUpTransitionPlan')
    expect(readFileSync(join(here, 'labels.ts'), 'utf8')).toContain("submitted: 'Applied'")
    expect(readFileSync(join(here, 'labels.ts'), 'utf8')).toContain("submitted: 'Applied'")
  })

  it('loads client policies from household production relationships without compensation', () => {
    expect(policiesTab).toContain('fetchHouseholdProductionApplications')
    expect(policiesTab).toContain('crmProductionPath')
    expect(policiesTab).not.toContain('expected_compensation')
    expect(policiesTab).not.toContain('fetchLiveExpectedCompensations')
    expect(productionApi).toContain('.eq(\'household_id\', householdId)')
    expect(productionApi).toContain('expected_compensations: []')
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
  })

  it('shows DOB from household_members and excludes inactive products from the picker', () => {
    expect(householdSummary).toContain('date_of_birth')
    expect(newClientDialog).toContain('Date of birth')
    expect(applicationApi).toContain(".eq('is_active', true)")
    expect(PROPOSED_PRODUCTION_STAGES).toEqual(['paramed', 'sent_to_draft', 'premium_drafted'])
    expect(PRODUCTION_STAGES).toContain('paramed')
    expect(PRODUCTION_STAGES).toContain('sent_to_draft')
    expect(PRODUCTION_STAGES).toContain('premium_drafted')
  })

  it('does not use the service role in browser production files', () => {
    const files = existsSync(migrationsDir) ? readdirSync(migrationsDir) : []
    expect(files.some((name) => name.includes('037_client_production_workflow_extensions'))).toBe(
      true,
    )
    expect(applicationApi).not.toContain('SERVICE_ROLE')
    expect(productionApi).not.toContain('SERVICE_ROLE')
    expect(newPage).not.toContain('SERVICE_ROLE')
    expect(policiesTab).not.toContain('SERVICE_ROLE')
    expect(quickAdd).not.toContain('SERVICE_ROLE')
  })
})
