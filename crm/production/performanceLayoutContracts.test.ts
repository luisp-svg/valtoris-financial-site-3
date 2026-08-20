import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const dashboardUi = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const dashboardView = readFileSync(join(here, 'dashboardView.ts'), 'utf8')
const productionMetrics = readFileSync(join(here, 'productionMetrics.ts'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('Production Performance layout contracts', () => {
  it('uses one shared column definition for header and body rows', () => {
    expect(styles).toContain(
      '--pp-funnel-columns: minmax(8rem, 1.6fr) repeat(3, minmax(4.5rem, 1fr));',
    )
    const row = cssRule(styles, '.crm-production-funnel-row')
    expect(row).toContain('grid-template-columns: var(--pp-funnel-columns)')
    expect(dashboardUi).toContain('className="crm-production-funnel-row is-head"')
    expect(dashboardUi).toContain('className="crm-production-funnel-row"')
    expect(dashboardUi).toContain('role="columnheader"')
    expect(dashboardUi).toContain('role="rowheader"')
    expect(dashboardUi).toContain('role="cell"')
  })

  it('left-aligns Metric and right-aligns Life / FIA / Total on both header and values', () => {
    const metric = cssRule(styles, '.crm-production-funnel-row .is-metric,\n.crm-production-funnel-row [role=\'rowheader\']')
    const numeric = cssRule(styles, '.crm-production-funnel-row .is-num,\n.crm-production-funnel-row [role=\'cell\']')
    expect(metric).toContain('text-align: left')
    expect(numeric).toContain('text-align: right')
    expect(dashboardUi).toContain('className="is-metric" role="columnheader">Metric')
    expect(dashboardUi).toContain('className="is-num" role="columnheader">Life')
    expect(dashboardUi).toContain('className="is-num" role="columnheader">FIA')
    expect(dashboardUi).toContain('className="is-num" role="columnheader">Total')
    expect(dashboardUi).toContain('className="is-metric" role="rowheader"')
    expect(dashboardUi).toContain('className="is-num" role="cell" data-label="Life"')
    expect(dashboardUi).toContain('className="is-num" role="cell" data-label="FIA"')
    expect(dashboardUi).toContain('className="is-num" role="cell" data-label="Total"')
    expect(styles).not.toMatch(/\.crm-production-funnel-row\.is-head[^{]*\{[^}]*margin-left/)
    expect(styles).not.toMatch(/\.crm-production-funnel-row \.is-num[^{]*\{[^}]*padding-right:\s*\d+px/)
  })

  it('keeps existing metric labels and funnel formulas', () => {
    expect(dashboardUi).toContain('label="Applied"')
    expect(dashboardUi).toContain('label="Placed / In Force"')
    expect(dashboardUi).toContain('label="Declined"')
    expect(dashboardUi).toContain('label="Not Taken"')
    expect(dashboardUi).toContain('label="Withdrawn"')
    expect(dashboardUi).toContain('label="Pending"')
    expect(dashboardUi).toContain('label="Gross Placement Rate"')
    expect(dashboardUi).toContain('label="Resolved Placement Rate"')
    expect(dashboardUi).toContain('life[kind]')
    expect(dashboardUi).toContain('fia[kind]')
    expect(dashboardUi).toContain('all[kind]')
    expect(dashboardUi).toContain('life.grossPlacementRate')
    expect(dashboardUi).toContain('fia.grossPlacementRate')
    expect(dashboardUi).toContain('all.grossPlacementRate')
    expect(dashboardUi).toContain('life.resolvedPlacementRate')
    expect(dashboardUi).toContain('fia.resolvedPlacementRate')
    expect(dashboardUi).toContain('all.resolvedPlacementRate')
    expect(dashboardView).toContain('applicationsInSubmittedCohort')
    expect(dashboardView).toContain('computeProductionFunnel')
    expect(productionMetrics).toContain('grossPlacementRate')
    expect(productionMetrics).toContain('resolvedPlacementRate')
    expect(productionMetrics).toContain("Issued / Awaiting Placement")
    expect(dashboardUi).not.toMatch(/\.update\s*\(|\.insert\s*\(|\.rpc\s*\(/)
  })
})
