import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const snapshot = readFileSync(join(here, 'AgencySnapshotSection.tsx'), 'utf8')
const home = readFileSync(join(here, 'OwnerOpsHome.tsx'), 'utf8')
const quickActions = readFileSync(join(here, '../dashboard/QuickActions.tsx'), 'utf8')
const aggregate = readFileSync(join(here, 'aggregateOwnerOps.ts'), 'utf8')
const types = readFileSync(join(here, 'types.ts'), 'utf8')
const api = readFileSync(join(here, 'ownerOpsApi.ts'), 'utf8')
const migrationsDir = join(root, 'supabase/migrations')

describe('Agency Operations mobile layout contracts', () => {
  it('does not add an Owner Ops migration; 045 is policy lifecycle only', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
  })

  it('contains the dashboard column so nowrap children cannot widen the page', () => {
    const layoutRule = styles.match(/\.crm-dashboard-layout \{[^}]+\}/)?.[0] ?? ''
    expect(layoutRule).toContain('min-width: 0')
    expect(layoutRule).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(layoutRule).not.toContain('overflow-x: auto')
    const tableWrapRule = styles.match(/\.crm-owner-ops-table-wrap \{[^}]+\}/)?.[0] ?? ''
    expect(tableWrapRule).toContain('min-width: 0')
    expect(tableWrapRule).toContain('max-width: 100%')
    expect(tableWrapRule).toContain('overflow-x: auto')
  })

  it('stacks Quick Actions full-width at the 429px phone breakpoint instead of a 140px flex row', () => {
    expect(quickActions).toContain('crm-dashboard-quick-action-row')
    expect(quickActions).toContain('New Opportunity')
    expect(quickActions).toContain('Add Task')
    expect(styles).toMatch(
      /@media \(max-width: 429px\) \{[\s\S]*?\.crm-dashboard-quick-action-row \{[\s\S]*?grid-template-columns: 1fr;/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 429px\) \{[\s\S]*?\.crm-dashboard-quick-action-row \.crm-primary-btn,[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?flex: none;/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 960px\) \{[\s\S]*?\.crm-dashboard-quick-action-row \.crm-primary-btn,[\s\S]*?min-height: 44px;/,
    )
  })

  it('collapses Agency Snapshot to one KPI card per row on narrow phones', () => {
    expect(home).toContain('AgencySnapshotSection')
    expect(snapshot).toContain('crm-owner-ops-metric-grid')
    expect(snapshot).toContain('crm-dashboard-footnote')
    expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(styles).toMatch(
      /@media \(max-width: 960px\) \{[\s\S]*?\.crm-owner-ops-metric-grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 429px\) \{[\s\S]*?\.crm-owner-ops-metric-grid \{[\s\S]*?grid-template-columns: 1fr;/,
    )
    expect(styles).toMatch(/\.crm-dashboard-metric \{[\s\S]*?min-width: 0;/)
  })

  it('lets Snapshot copy wrap inside the panel', () => {
    expect(styles).toMatch(
      /\.crm-dashboard-footnote \{[\s\S]*?min-width: 0;[\s\S]*?overflow-wrap: anywhere;/,
    )
    expect(styles).toMatch(/\.crm-dashboard-metric-label \{[\s\S]*?overflow-wrap: anywhere;/)
  })

  it('does not change Agency Snapshot queries, RPCs, or metric math', () => {
    expect(api).not.toMatch(/\.rpc\s*\(/)
    expect(api).not.toContain('SERVICE_ROLE')
    expect(types).toContain('activeHouseholds')
    expect(types).toContain('wonThisMonth')
    expect(aggregate).toContain('countOpenLike')
    expect(aggregate).toContain('countStaleOpportunities')
    expect(snapshot).toContain('snapshot.monthTimeZone')
    expect(snapshot).toContain('closed_at in agency month')
  })
})
