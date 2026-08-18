import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTES, crmCommissionsPath } from '../../constants/routes'
import { getCrmSidebarNavItems } from '../../platform/registry'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
const workspace = readFileSync(join(here, 'CommissionWorkspace.tsx'), 'utf8')
const summary = readFileSync(join(here, 'CommissionSummary.tsx'), 'utf8')
const queueTable = readFileSync(join(here, 'CommissionQueueTable.tsx'), 'utf8')
const queueCards = readFileSync(join(here, 'CommissionQueueCards.tsx'), 'utf8')
const detail = readFileSync(join(here, 'CommissionWorkItemDetail.tsx'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const shell = readFileSync(join(root, 'crm/components/CrmShell.tsx'), 'utf8')
const productionPage = readFileSync(join(root, 'pages/crm/CrmProductionPage.tsx'), 'utf8')
const migrationsDir = join(root, 'supabase/migrations')

describe('commission Phase 1 route and navigation', () => {
  it('registers authenticated /crm/commissions and a Commissions sidebar item after Production', () => {
    expect(ROUTES.crmCommissions).toBe('/crm/commissions')
    expect(crmCommissionsPath()).toBe('/crm/commissions')
    const nav = getCrmSidebarNavItems()
    const productionIdx = nav.findIndex((item) => item.path === '/crm/production')
    const commissionsIdx = nav.findIndex((item) => item.path === '/crm/commissions')
    expect(nav[commissionsIdx]).toEqual({ label: 'Commissions', path: '/crm/commissions' })
    expect(commissionsIdx).toBe(productionIdx + 1)
    expect(appSource).toContain('path="commissions"')
    expect(appSource).toContain('CrmCommissionsPage')
    expect(appSource.indexOf('CrmProtectedGate')).toBeLessThan(appSource.indexOf('path="commissions"'))
    expect(shell).toContain('/crm/commissions')
  })

  it('does not put commissions on the public site or Advisor Login', () => {
    const header = readFileSync(join(root, 'components/SiteHeader.tsx'), 'utf8')
    const footer = readFileSync(join(root, 'components/SiteFooter.tsx'), 'utf8')
    expect(header).not.toContain('/crm/commissions')
    expect(footer).not.toContain('/crm/commissions')
    expect(header).not.toMatch(/Commissions/)
  })

  it('keeps Production Advisor Compensation in place', () => {
    expect(productionPage).toContain('buildAdvisorCompensationDashboard')
    expect(productionPage).toContain('ProductionDashboard')
  })
})

describe('commission Phase 2 owner write workspace', () => {
  it('loads 034/035 in batches and snapshots only on drill-down', () => {
    expect(page).toContain('fetchLiveExpectedCompensations')
    expect(page).toContain('fetchPaidCommissionEvents')
    expect(page.match(/fetchLiveExpectedCompensations\(/g)?.length).toBe(1)
    expect(page.match(/fetchPaidCommissionEvents\(/g)?.length).toBe(1)
    expect(page).toContain('fetchWritingCommissionSnapshot')
    expect(page).toContain('createManualCommissionIdempotencyKey')
    expect(page).toContain('setReloadKey')
    expect(page).toContain('setSnapshotNonce')
    expect(page).not.toContain('paidCents +=')
    expect(page).not.toContain('outstandingCents =')
    expect(page).toContain('selectedItem')
    expect(workspace).not.toContain('fetchWritingCommissionSnapshot')
    expect(queueTable).not.toContain('fetchWritingCommissionSnapshot')
  })

  it('keeps import RPCs out of the Phase 1/2 commissions workspace', () => {
    const sources = [page, workspace, summary, queueTable, queueCards, detail]
    for (const source of sources) {
      expect(source).not.toContain('create_commission_import_batch')
      expect(source).not.toContain('post_commission_import_row')
      expect(source).not.toMatch(/\.insert\s*\(/)
      expect(source).not.toMatch(/\.update\s*\(/)
      expect(source).not.toMatch(/\.delete\s*\(/)
    }
    expect(existsSync(join(migrationsDir, '039_commission_lifecycle.sql'))).toBe(false)
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name))
    expect(numbered).toHaveLength(39)
    expect(numbered).toContain('039_commission_import_review_post_hardening.sql')
  })

  it('uses generic workspace labels and does not name the shell Life Commissions', () => {
    expect(workspace).toContain('Commission workspace')
    expect(workspace).not.toMatch(/Life Commissions/)
    expect(queueTable).toContain('scope="col">Client</th>')
    expect(queueTable).toContain('scope="col">Reference</th>')
    expect(queueTable).toContain('scope="col">Provider</th>')
    expect(queueTable).toContain('scope="col">Product / Service</th>')
    expect(queueTable).toContain('Writing Advisor')
    expect(summary).toContain('Expected')
    expect(summary).toContain('Outstanding')
    expect(summary).toContain('Paid')
    expect(summary).toContain('Chargebacks')
    expect(summary).toContain('Net Paid')
  })
})
