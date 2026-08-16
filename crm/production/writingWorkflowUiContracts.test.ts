import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const writingSplits = readFileSync(join(here, 'writingSplits.ts'), 'utf8')
const writingFields = readFileSync(join(here, 'WritingAdvisorsFields.tsx'), 'utf8')
const entryForm = readFileSync(join(here, 'ApplicationEntryForm.tsx'), 'utf8')
const editForm = readFileSync(join(here, 'ApplicationEditForm.tsx'), 'utf8')
const newPage = readFileSync(join(here, '../../pages/crm/CrmProductionNewPage.tsx'), 'utf8')
const editPage = readFileSync(join(here, '../../pages/crm/CrmProductionEditPage.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const migrationsDir = join(here, '../../supabase/migrations')
const applicationErrors = readFileSync(join(here, 'applicationErrors.ts'), 'utf8')
const applicationView = readFileSync(join(here, 'applicationView.ts'), 'utf8')
const editView = readFileSync(join(here, 'applicationEditView.ts'), 'utf8')

describe('UI-2 policy production writing workflow contracts', () => {
  it('creates through the existing application API and saves allocations via the wrapper', () => {
    expect(newPage).toContain('submitProductionApplication')
    expect(editPage).toContain('saveProductionApplicationEdit')
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.create")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.update")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.setAllocations")
    expect(applicationApi).toContain('toWritingAllocationRpcPayload')
    expect(applicationApi).not.toMatch(/\.insert\s*\(/)
    expect(applicationApi).not.toMatch(/\.upsert\s*\(/)
    expect(applicationApi).not.toMatch(/from\('policy_agent_allocations'\)/)
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(productionApi).not.toMatch(/\.insert\s*\(/)
  })

  it('never sends writing_contract_level or compensation rate and never mixes house or servicing rows', () => {
    expect(writingSplits).toContain("allocation_role: 'writing'")
    expect(writingSplits).toContain("recipient_type: 'advisor'")
    expect(writingFields).toContain('Writing advisors')
    expect(writingFields).not.toContain('writing_contract_level')
    expect(writingFields).not.toContain('compensation_rate')
    expect(writingFields).not.toContain('expected commission')
    expect(writingFields).not.toContain('Commission bps')
    expect(writingFields).not.toContain('Production credit')
    expect(writingFields).not.toMatch(/recipient_type: 'house'/)
    expect(writingFields).not.toMatch(/allocation_role: 'servicing'/)
    expect(editForm).not.toMatch(/allocation_role: 'servicing'/)
    expect(editForm).not.toMatch(/recipient_type: 'house'/)
  })

  it('uses carrier-first product filtering and product-line money fields', () => {
    expect(newPage).toContain('productsForCarrier')
    expect(newPage).toContain("setProductId('')")
    expect(editPage).toContain('productsForCarrier')
    expect(editPage).toContain("productId: '', productLine: ''")
    expect(entryForm).toContain('Submitted premium (USD)')
    expect(entryForm).toContain('Annuity deposit (USD)')
    expect(editForm).toContain('Submitted premium')
    expect(editForm).toContain('Annuity deposit')
    expect(entryForm).toContain('formatApplicationProductLineLabel')
    expect(entryForm).toContain('{product.name}')
  })

  it('does not fabricate expected compensation or let unresolved status block submit UX', () => {
    expect(applicationApi).not.toContain('pp_expected_compensation')
    expect(applicationApi).not.toContain('product_compensation_schedules')
    expect(applicationApi).not.toContain('fetchLiveExpectedCompensations')
    expect(newPage).not.toContain('fetchLiveExpectedCompensations')
    expect(editPage).not.toContain('fetchLiveExpectedCompensations')
    expect(entryForm).toContain('unresolved compensation does not block')
    expect(applicationView).not.toContain('calculation_status')
    expect(editView).not.toContain('calculation_status')
  })

  it('reloads canonical application state after save and follows backend edit permissions', () => {
    expect(editPage).toContain('setReloadKey')
    expect(editPage).toContain('fetchProductionApplicationById')
    expect(editPage).toContain('canShowProductionEditAction')
    expect(editPage).toContain('canReplaceAllocations')
    expect(editView).toContain('canReplaceAllocations')
    expect(editPage).toContain('This application can no longer be edited')
  })

  it('formats known errors without leaking CRM_PP or Postgres internals', () => {
    expect(applicationErrors).toContain('Writing allocations must total 100%.')
    expect(applicationErrors).toContain('Premium information is incomplete.')
    expect(applicationErrors).toContain('You do not have permission to update this application.')
    expect(applicationErrors).toContain('Missing client or required fields.')
    expect(applicationErrors).toContain("return APPLICATION_GENERIC_ERROR")
    expect(applicationApi).toContain('formatApplicationUserError')
  })

    it('stacks the writing form on mobile and does not add a compensation-UI migration', () => {
    expect(styles).toContain('.crm-application-allocation-row')
    expect(styles).toContain('grid-template-columns: 1fr')
    expect(styles).toContain('.crm-application-allocation-percent input')
    expect(styles).toContain('min-height: 48px')
    expect(styles).toContain('max-width: 899px')
    expect(writingFields).toContain('crm-application-allocation-row')
    expect(existsSync(join(migrationsDir, '037_policy_production_compensation_ui.sql'))).toBe(false)
    const migrationFiles = readdirSync(migrationsDir)
    expect(migrationFiles.filter((name) => name.startsWith('037'))).toEqual([
      '037_client_production_workflow_extensions.sql',
    ])
    expect(applicationApi).not.toContain('CREATE TABLE')
    expect(applicationApi).not.toContain('product_compensation_schedules')
  })
})
