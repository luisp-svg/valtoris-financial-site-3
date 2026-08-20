import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCrmSidebarNavItems } from '../../platform/registry'
import { ROUTES, crmProductionEditPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const appSource = readFileSync(join(here, '../../src/App.tsx'), 'utf8')
const editPage = readFileSync(join(here, '../../pages/crm/CrmProductionEditPage.tsx'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const form = readFileSync(join(here, 'ApplicationEditForm.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('production application edit P1B-2C contracts', () => {
  it('registers /crm/production/:applicationId/edit before the detail route without a sidebar item', () => {
    const nav = getCrmSidebarNavItems()
    expect(nav.find((item) => item.path === '/crm/production')?.label).toBe('Production')
    expect(nav.some((item) => item.path.includes('/edit'))).toBe(false)
    expect(ROUTES.crmProductionEdit).toBe('/crm/production/:applicationId/edit')
    expect(crmProductionEditPath('abc')).toBe('/crm/production/abc/edit')
    expect(appSource).toContain('path="production/:applicationId/edit"')
    expect(appSource.indexOf('path="production/:applicationId/edit"')).toBeLessThan(
      appSource.indexOf('path="production/:applicationId" element={<CrmProductionDetailPage'),
    )
  })

  it('shows Edit Application on detail, pending lock on edit', () => {
    expect(detailPage).toContain('Edit Application')
    expect(detailPage).not.toContain('Edit / Complete')
    expect(detailPage).toContain('canShowProductionEditAction')
    expect(detailPage).toContain('crmProductionEditPath(application.id)')
    expect(editPage).toContain('if (submitting) return')
    expect(editPage).toContain('setReloadKey')
    expect(editPage).toContain('Edit Application')
    expect(editPage).toContain('Issued and in-force historical corrections are not handled on this screen.')
    expect(editPage).toContain('navigate(crmProductionPath(application.id))')
    expect(form).toContain('crm-field-locked')
    expect(form).toContain('FIA does not use an insured')
    expect(form).toContain('disabled={props.submitting')
    expect(form).toContain('This screen edits application details')
    expect(editPage).toContain('Stage changes stay in the Case workspace')
    expect(styles).toContain('.crm-application-edit-actions')
    expect(styles).toContain('max-width: 899px')
  })

  it('confines edit writes to approved RPCs and keeps productionApi SELECT-only', () => {
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(applicationApi).not.toMatch(/\.insert\s*\(/)
    expect(applicationApi).not.toMatch(/\.upsert\s*\(/)
    expect(applicationApi).not.toContain('SERVICE_ROLE')
    expect(applicationApi).not.toContain("from('activities')")
    expect(applicationApi).not.toContain('soft_delete_policy_application')
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.update")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.setNumber")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.correctNumber")
    expect(applicationApi).not.toContain('contract_level_snapshot')
    expect(applicationApi).not.toContain('points_share_scaled')
  })
})
