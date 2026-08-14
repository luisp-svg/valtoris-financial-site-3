import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCrmSidebarNavItems } from '../../platform/registry'
import { ROUTES, crmProductionCatalogPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const catalogApi = readFileSync(join(here, 'catalogApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const appSource = readFileSync(join(here, '../../src/App.tsx'), 'utf8')
const catalogPage = readFileSync(join(here, '../../pages/crm/CrmProductionCatalogPage.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const carrierForm = readFileSync(join(here, 'CatalogCarrierForm.tsx'), 'utf8')
const productForm = readFileSync(join(here, 'CatalogProductForm.tsx'), 'utf8')
const deactivate = readFileSync(join(here, 'CatalogDeactivateDialog.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('production catalog P1B-2A contracts', () => {
  it('registers catalog under Production without a Catalog sidebar item', () => {
    const nav = getCrmSidebarNavItems()
    expect(nav.find((item) => item.path === '/crm/production')?.label).toBe('Production')
    expect(nav.some((item) => /catalog/i.test(item.label) || item.path.includes('catalog'))).toBe(false)
    expect(ROUTES.crmProductionCatalog).toBe('/crm/production/catalog')
    expect(crmProductionCatalogPath()).toBe('/crm/production/catalog')
    expect(appSource).toContain('path="production/catalog"')
    expect(appSource.indexOf('path="production/catalog"')).toBeLessThan(
      appSource.indexOf('path="production/:applicationId"'),
    )
  })

  it('shows owner catalog action and omits it for advisors in the queue page', () => {
    expect(queuePage).toContain('isOwner')
    expect(queuePage).toContain('Manage carriers & products')
    expect(queuePage).toContain('ROUTES.crmProductionCatalog')
    expect(catalogPage).toContain('shouldShowCatalogManagement')
    expect(catalogPage).toContain('Catalog management is available to owners')
  })

  it('keeps productionApi SELECT-only and confines catalog writes to approved RPCs', () => {
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(productionApi).not.toMatch(/\.insert\s*\(/)
    expect(catalogApi).not.toMatch(/\.insert\s*\(/)
    expect(catalogApi).not.toMatch(/\.update\s*\(/)
    expect(catalogApi).not.toMatch(/\.upsert\s*\(/)
    expect(catalogApi).not.toMatch(/\.delete\s*\(/)
    expect(catalogApi).toContain("rpc(CATALOG_RPC.createCarrier")
    expect(catalogApi).toContain("rpc(CATALOG_RPC.updateCarrier")
    expect(catalogApi).toContain("rpc(CATALOG_RPC.createProduct")
    expect(catalogApi).toContain("rpc(CATALOG_RPC.updateProduct")
    expect(catalogApi).not.toContain('create_policy_application')
    expect(catalogApi).not.toContain('SERVICE_ROLE')
    expect(catalogApi).not.toContain('from(\'activities\')')
  })

  it('locks immutable fields and requires deactivation confirmation', () => {
    expect(carrierForm).toContain('readOnly={codeLocked}')
    expect(carrierForm).toContain('Carrier code cannot be changed after creation')
    expect(productForm).toContain('Carrier cannot be changed after product creation')
    expect(productForm).toContain('Product line cannot be changed after creation')
    expect(deactivate).toContain('role="dialog"')
    expect(deactivate).toContain('Keep active')
    expect(catalogPage).toContain('setDeactivateDialog')
    expect(catalogPage).toContain('handleConfirmDeactivate')
  })

  it('uses mobile-accessible catalog forms', () => {
    expect(carrierForm).toContain('crm-field')
    expect(productForm).toContain('crm-field')
    expect(styles).toContain('.crm-catalog-dialog .crm-form-actions')
    expect(styles).toContain('max-width: 899px')
    expect(catalogPage).toContain('aria-label="Carriers"')
    expect(catalogPage).toContain('aria-label="Products"')
  })
})
