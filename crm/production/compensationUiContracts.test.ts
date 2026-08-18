import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const compensationApi = readFileSync(join(here, 'compensationApi.ts'), 'utf8')
const compensationView = readFileSync(join(here, 'compensationView.ts'), 'utf8')
const compensationLabels = readFileSync(join(here, 'compensationLabels.ts'), 'utf8')
const table = readFileSync(join(here, 'ProductionQueueTable.tsx'), 'utf8')
const cards = readFileSync(join(here, 'ProductionQueueCards.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const expectedPanel = readFileSync(join(here, 'ExpectedCompensationPanel.tsx'), 'utf8')
const actualPanel = readFileSync(join(here, 'ActualCommissionPanel.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const migrationsDir = join(here, '../../supabase/migrations')

describe('UI-1 compensation read-view contracts', () => {
  it('keeps productionApi SELECT-only with no RPC', () => {
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(productionApi).not.toMatch(/\.insert\s*\(/)
    expect(productionApi).not.toMatch(/\.update\s*\(/)
    expect(productionApi).not.toMatch(/\.delete\s*\(/)
    expect(productionApi).not.toContain('pp_writing_commission_snapshot')
    expect(productionApi).not.toContain('SERVICE_ROLE')
  })

  it('reads expected via 034 SELECT and actual via the 035 snapshot RPC', () => {
    expect(compensationApi).toContain("from('policy_application_expected_compensations')")
    expect(compensationApi).toContain(".is('superseded_at', null)")
    expect(compensationApi).toContain("rpc('pp_writing_commission_snapshot'")
    expect(compensationApi).toContain('p_application_id')
    expect(compensationApi).not.toContain('pp_expected_compensation_snapshot')
    expect(compensationApi).not.toContain('product_compensation_schedules')
    expect(compensationApi).not.toContain('SERVICE_ROLE')
    expect(compensationApi).not.toMatch(/\.insert\s*\(/)
    expect(compensationApi).not.toMatch(/\.update\s*\(/)
    expect(compensationApi).not.toMatch(/\.upsert\s*\(/)
    expect(compensationApi).not.toMatch(/\.delete\s*\(/)
  })

  it('does not add a compensation-UI migration or change the list into N+1 snapshot calls', () => {
    expect(existsSync(join(migrationsDir, '037_policy_production_compensation_ui.sql'))).toBe(false)
    const migrationFiles = readdirSync(migrationsDir)
    expect(migrationFiles.filter((name) => name.startsWith('037'))).toEqual([
      '037_client_production_workflow_extensions.sql',
    ])
    expect(queuePage).toContain('fetchLiveExpectedCompensations')
    expect(queuePage.match(/fetchLiveExpectedCompensations\(/g)?.length).toBe(1)
    expect(queuePage).not.toContain('pp_writing_commission_snapshot')
    expect(queuePage).not.toContain('fetchWritingCommissionSnapshot')
    expect(table).not.toContain('fetchWritingCommissionSnapshot')
    expect(cards).not.toContain('fetchWritingCommissionSnapshot')
    expect(detailPage.match(/fetchWritingCommissionSnapshot\(/g)?.length).toBe(1)
  })

  it('extends the existing Production list with expected-only columns', () => {
    expect(table).toContain('scope="col">Split</th>')
    expect(table).toContain('scope="col">Expected status</th>')
    expect(table).toContain('scope="col">Expected</th>')
    expect(table).toContain('scope="col">Review</th>')
    expect(table).toContain('CompensationStatusBadge')
    expect(table).toContain('crm-production-money')
    expect(table).toContain('deriveExpectedListPresentation')
    expect(table).toContain('listExpectedAmountCaption')
    expect(compensationView).toContain("options.viewer === 'advisor' ? 'your_expected'")
    expect(cards).toContain('<dt>Expected</dt>')
    expect(cards).toContain('CompensationStatusBadge')
    expect(cards).toContain('listExpectedAmountCaption')
    expect(compensationView).toContain("return 'Your expected'")
    expect(cards).toContain('Split')
    expect(queuePage).toContain('viewer={viewer}')
    expect(queuePage).toContain("role === 'owner' ? 'owner' : 'advisor'")
  })

  it('adds expected and actual panels to the existing detail page without a new tab architecture', () => {
    expect(detailPage).toContain('ExpectedCompensationPanel')
    expect(detailPage).toContain('ActualCommissionPanel')
    expect(detailPage).toContain('writingReceivableExpected={application.writing_receivable_expected}')
    expect(expectedPanel).toContain('writingReceivableExpected')
    expect(compensationView).toContain(
      'Valtoris does not currently expect writing compensation on this application.',
    )
    expect(detailPage).not.toMatch(/tab architecture|CompensationTabs|role="tablist"/i)
    expect(expectedPanel).toContain('Your expected compensation')
    expect(expectedPanel).toContain('OwnerExpectedTable')
    expect(expectedPanel).not.toContain('product_compensation_schedule_id')
    expect(actualPanel).toContain('Gross paid')
    expect(actualPanel).toContain('Remaining expected')
    expect(actualPanel).toContain('Expected compensation unavailable')
    expect(actualPanel).toContain('Reversed / corrected')
    expect(actualPanel).not.toContain('onClick')
    expect(actualPanel).not.toMatch(/<button/)
    expect(actualPanel).not.toContain('reverse_policy_writing_commission_event')
    expect(actualPanel).not.toContain('record_policy_writing_commission_event')
  })

  it('does not introduce pending/eligible/released compensation states or rate-card UI', () => {
    const uiSources = [compensationView, compensationLabels, expectedPanel, actualPanel]
    for (const source of uiSources) {
      expect(source).not.toMatch(/\bPending\b/)
      expect(source).not.toMatch(/\bEligible\b/)
      expect(source).not.toMatch(/\bReleased\b/)
    }
    expect(compensationView).toContain("primary: 'no_payments'")
    expect(compensationView).toContain("primary: 'expected_unavailable'")
    expect(queuePage).not.toContain('Manage rate cards')
    expect(detailPage).not.toContain('commission import')
  })

  it('uses tabular money and review badges that are not color-only', () => {
    expect(styles).toContain('.crm-production-comp-badge')
    expect(styles).toContain('.crm-production-comp-badge.is-review')
    expect(styles).toContain('border-style: dashed')
    expect(styles).toContain('.crm-production-money')
    expect(styles).toContain('font-variant-numeric: tabular-nums')
    expect(styles).toContain('.crm-production-money.is-negative')
  })
})
