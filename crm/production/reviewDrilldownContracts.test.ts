import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { crmProductionPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const dashboardUi = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'ExpectedReviewDialog.tsx'), 'utf8')
const view = readFileSync(join(here, 'advisorCompensationView.ts'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('expected-compensation review drill-down contracts', () => {
  it('makes the review count a keyboard-accessible control that opens the dialog', () => {
    expect(dashboardUi).toContain('crm-production-review-btn')
    expect(dashboardUi).toContain('type="button"')
    expect(dashboardUi).toContain('ExpectedReviewDialog')
    expect(dashboardUi).toContain("setReviewScope('all')")
    expect(dashboardUi).toContain('setReviewScope({ advisorId: row.advisorId })')
    expect(dialog).toContain('role="dialog"')
    expect(dialog).toContain('aria-modal="true"')
    expect(dialog).toContain('aria-labelledby')
    expect(dialog).toContain('Close')
    expect(dialog).toContain("event.key === 'Escape'")
  })

  it('maps loaded review rows only and navigates to the existing detail route', () => {
    expect(view).toContain('listExpectedReviewItems')
    expect(view).toContain("calculation_status !== 'review_required'")
    expect(view).toContain("calculation_status !== 'unavailable'")
    expect(view).toContain('formatExpectedUnavailableOrReviewCopy')
    expect(dialog).toContain('crmProductionPath(item.applicationId)')
    expect(dialog).toContain('item.householdName')
    expect(dialog).toContain('item.carrierName')
    expect(dialog).toContain('item.productName')
    expect(dialog).toContain('item.advisorName')
    expect(dialog).toContain('item.stageLabel')
    expect(dialog).toContain('item.reviewReason')
    expect(crmProductionPath('app-1')).toBe('/crm/production/app-1')
    expect(queuePage).not.toContain('crm/production/review')
  })

  it('does not expose rate-card fields or mutate compensation', () => {
    expect(dialog).not.toContain('writing_rate')
    expect(dialog).not.toContain('commission_bps')
    expect(dialog).not.toContain('pp_compensation_rate')
    expect(dialog).not.toMatch(/\.update\s*\(|\.insert\s*\(|\.rpc\s*\(/)
    expect(dialog).not.toContain('createSupabaseBrowserClient')
    expect(view).not.toContain('SERVICE_ROLE')
    expect(dashboardUi).not.toContain('SERVICE_ROLE')
    expect(existsSync(join(here, '../../supabase/migrations/039_expected_review.sql'))).toBe(false)
  })

  it('keeps unresolved expected visually distinct from a definitive $0', () => {
    expect(dashboardUi).toContain('is-unresolved')
    expect(dashboardUi).toContain('Incomplete')
    expect(dashboardUi).toContain('row.expectedCents === 0 && row.reviewCount > 0')
    expect(styles).toContain('.crm-production-comp-incomplete')
    expect(styles).toContain('.crm-production-comp-grid')
    expect(styles).toContain('grid-template-columns: minmax(9.5rem, 1.5fr) repeat(5, minmax(5.75rem, 1fr))')
    expect(styles).toContain('@media (max-width: 799px)')
    expect(styles).toContain("content: attr(data-label)")
  })
})
