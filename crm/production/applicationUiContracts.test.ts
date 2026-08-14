import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCrmSidebarNavItems } from '../../platform/registry'
import { ROUTES, crmProductionNewPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const appSource = readFileSync(join(here, '../../src/App.tsx'), 'utf8')
const newPage = readFileSync(join(here, '../../pages/crm/CrmProductionNewPage.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const form = readFileSync(join(here, 'ApplicationEntryForm.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('production application entry P1B-2B contracts', () => {
  it('registers /crm/production/new before the detail route without a sidebar item', () => {
    const nav = getCrmSidebarNavItems()
    expect(nav.find((item) => item.path === '/crm/production')?.label).toBe('Production')
    expect(nav.some((item) => item.path === '/crm/production/new')).toBe(false)
    expect(ROUTES.crmProductionNew).toBe('/crm/production/new')
    expect(crmProductionNewPath()).toBe('/crm/production/new')
    expect(appSource).toContain('path="production/new"')
    expect(appSource.indexOf('path="production/new"')).toBeLessThan(
      appSource.indexOf('path="production/:applicationId"'),
    )
  })

  it('shows New application for owner and advisor and keeps catalog owner-only', () => {
    expect(queuePage).toContain('New application')
    expect(queuePage).toContain('ROUTES.crmProductionNew')
    expect(queuePage).toContain('isOwner')
    expect(queuePage).toContain('Manage carriers & products')
    expect(newPage).toContain('shouldShowCatalogManagement')
    expect(newPage).toContain('Catalog setup required')
    expect(newPage).toContain('Catalog management is owner-only')
  })

  it('keeps productionApi SELECT-only and confines writes to the four approved RPCs', () => {
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(applicationApi).not.toMatch(/\.insert\s*\(/)
    expect(applicationApi).not.toMatch(/\.update\s*\(/)
    expect(applicationApi).not.toMatch(/\.upsert\s*\(/)
    expect(applicationApi).not.toMatch(/\.delete\s*\(/)
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.create")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.setParticipants")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.setAllocations")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.transition")
    expect(applicationApi).not.toContain('update_policy_application')
    expect(applicationApi).not.toContain('SERVICE_ROLE')
    expect(applicationApi).not.toContain("from('activities')")
  })

  it('locks pending submit, product-line fields, and mobile-accessible form contracts', () => {
    expect(newPage).toContain('if (submitting) return')
    expect(form).toContain('Planned premium')
    expect(form).toContain('Initial deposit')
    expect(form).toContain('FIA does not use an insured')
    expect(form).toContain('disabled={props.submitting}')
    expect(form).toContain('crm-field')
    expect(styles).toContain('.crm-application-entry-form .crm-form-actions')
    expect(styles).toContain('max-width: 899px')
  })
})
