import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CRM_NAV_ITEMS } from '../nav'
import { ROUTES, crmProductionPath } from '../../constants/routes'
import { getCrmSidebarNavItems } from '../../platform/registry'

const here = dirname(fileURLToPath(import.meta.url))
const apiSource = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const appSource = readFileSync(join(here, '../../src/App.tsx'), 'utf8')

describe('production P1B-1 contracts', () => {
  it('registers Production navigation without a second Policies sidebar item', () => {
    const nav = getCrmSidebarNavItems()
    expect(nav.find((item) => item.path === '/crm/production')).toEqual({
      label: 'Production',
      path: '/crm/production',
    })
    expect(nav.some((item) => item.path === '/crm/policies')).toBe(false)
    expect(CRM_NAV_ITEMS).toEqual(nav)
  })

  it('exposes production routes and path helper', () => {
    expect(ROUTES.crmProduction).toBe('/crm/production')
    expect(ROUTES.crmPolicies).toBe('/crm/policies')
    expect(crmProductionPath('abc')).toBe('/crm/production/abc')
    expect(appSource).toContain('path="production"')
    expect(appSource).toContain('path="production/catalog"')
    expect(appSource).toContain('path="production/:applicationId"')
    expect(appSource).toContain('path="policies"')
  })

  it('keeps productionApi read-only (no mutation helpers)', () => {
    expect(apiSource).toMatch(/SELECT only/i)
    expect(apiSource).not.toMatch(/\.insert\s*\(/)
    expect(apiSource).not.toMatch(/\.update\s*\(/)
    expect(apiSource).not.toMatch(/\.upsert\s*\(/)
    expect(apiSource).not.toMatch(/\.delete\s*\(/)
    expect(apiSource).not.toMatch(/\.rpc\s*\(/)
    expect(apiSource).toContain("from('policy_applications')")
    expect(apiSource).toContain('policies!source_application_id')
  })

  it('documents owner-only writing-advisor filter in the queue page', () => {
    const page = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
    expect(page).toContain('isOwner')
    expect(page).toContain('Writing advisor')
    expect(page).toContain('PRODUCTION_STALE_DAYS_IN_STAGE')
    expect(page).toContain('days in stage')
    expect(page).not.toMatch(/priority score|risk score/i)
  })
})
