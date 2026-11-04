import { EXPECTED_MIGRATION_FILES } from '../../tests/helpers/migrationInventory'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const compensationApi = readFileSync(join(here, 'compensationApi.ts'), 'utf8')
const dashboardView = readFileSync(join(here, 'dashboardView.ts'), 'utf8')
const dashboardUi = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const productionMetrics = readFileSync(join(here, 'productionMetrics.ts'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')



describe('Phase A production dashboard contracts', () => {
  it('does not add a production dashboard or Case table migration and preserves 001–055 and permits insurance 056', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toEqual(EXPECTED_MIGRATION_FILES)
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((name) => name.startsWith('055_'))).toEqual(['055_integration_contact_links.sql'])
    expect(files.filter((name) => name.startsWith('056_'))).toEqual(['056_insurance_quote_intake.sql'])
  })

  it('does not introduce drag/drop, pending commission stage, or stage mutation', () => {
    expect(queuePage).not.toMatch(/dnd-kit|onDragEnd/)
    expect(queuePage).not.toMatch(/policy_notes|production_notes/)
    expect(dashboardUi).not.toMatch(/dnd-kit|createHouseholdNote/)
    expect(dashboardUi).not.toMatch(/pending commission|commission_released|eligible/)
    expect(dashboardView).not.toMatch(/pending|eligible|released/)
    expect(applicationApi).not.toMatch(/\.update\s*\(/)
    expect(productionApi).not.toMatch(/\.update\s*\(/)
    expect(productionApi).not.toMatch(/\.insert\s*\(/)
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(queuePage).not.toContain('.update(')
    expect(queuePage).not.toContain("rpc('transition_policy_application_stage'")
    expect(compensationApi).not.toMatch(/\.insert\s*\(/)
  })

  it('keeps paid aggregation on a batched 035 SELECT without snapshot N+1 or service-role', () => {
    expect(queuePage).toContain('fetchPaidCommissionEvents')
    expect(queuePage).not.toContain('fetchWritingCommissionSnapshot')
    expect(queuePage).not.toContain('pp_writing_commission_snapshot')
    expect(compensationApi).toContain("from('policy_writing_commission_events')")
    expect(compensationApi).toContain('fetchPaidCommissionEvents')
    expect(compensationApi).not.toMatch(/\.insert\s*\(/)
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(productionApi).not.toContain('SERVICE_ROLE')
    expect(compensationApi).not.toContain('SERVICE_ROLE')
    expect(dashboardView).not.toContain('SERVICE_ROLE')
  })

  it('uses shared queue filters for the queue and a separate dashboard period for KPIs', () => {
    expect(queuePage).toContain('applyProductionQueueView')
    expect(queuePage).toContain('buildProductionDashboard(filteredItems, { period: productionPeriod, today })')
    expect(queuePage).toContain('buildAdvisorCompensationDashboard')
    expect(queuePage).toContain('Written state')
    expect(queuePage).toContain('Submitted from')
    expect(queuePage).toContain('Submitted to')
    expect(queuePage).not.toContain('productionListCapWarning')
    expect(queuePage).toContain('all matching applications')
    expect(queuePage).toContain('DEFAULT_PRODUCTION_DASHBOARD_PERIOD')
    expect(queuePage).toContain('DEFAULT_COMPENSATION_DASHBOARD_PERIOD')
    expect(queuePage).not.toMatch(/useEffect\([\s\S]*, \[[^\]]*productionPeriod/)
    expect(queuePage).not.toMatch(/useEffect\([\s\S]*, \[[^\]]*compensationPeriod/)
    expect(dashboardUi).toContain('Annual Life Premium')
    expect(dashboardUi).toContain('Advisor Compensation')
    expect(dashboardUi).toContain('Outstanding')
    expect(dashboardUi).toContain('Chargebacks')
    expect(dashboardUi).toContain('Net Released')
    expect(dashboardUi).toContain('not a production stage')
    expect(dashboardUi).toContain('Current Active Life Protection')
    expect(dashboardUi).toContain('Total Protection Placed')
    expect(dashboardUi).not.toContain('>Active Life Protection<')
    expect(dashboardUi).toContain('Production Performance')
    expect(dashboardUi).toContain('Current Case Pipeline')
    expect(dashboardUi).toContain('pipelineStageLabel(stage)')
    expect(productionMetrics).toContain("Issued / Awaiting Placement")
    expect(productionMetrics).toContain("return 'Submitted'")
    expect(dashboardUi).toContain('Gross Placement Rate')
    expect(dashboardUi).toContain('Resolved Placement Rate')
    expect(dashboardUi).toContain('not Applied')
    expect(dashboardView).toContain('applicationsInSubmittedCohort')
    expect(dashboardUi).toContain('crm-production-comp-grid')
    expect(dashboardUi).toContain('role="table"')
    expect(dashboardUi).toContain('ExpectedReviewDialog')
    expect(dashboardUi).toContain('crm-production-review-btn')
    expect(dashboardUi).toContain('Incomplete')
    expect(dashboardUi).not.toContain('writing_rate')
    expect(dashboardUi).not.toContain('commission_bps')
    expect(dashboardUi).not.toMatch(/\.update\s*\(|\.insert\s*\(|\.rpc\s*\(/)
    expect(dashboardView).toContain("production_stage !== 'in_force'")
    expect(productionApi).toContain('submitted_premium_cents')
    expect(productionApi).toContain('annuity_deposit_cents')
    expect(productionApi).toContain('face_amount_cents')
    expect(productionApi).toContain('premium_mode')
    expect(productionApi).toContain('in_force_date')
    expect(styles).toContain('.crm-production-funnel-grid')
    expect(styles).toContain('.crm-production-funnel-row')
    expect(styles).toContain('grid-template-columns: var(--pp-funnel-columns)')
    expect(dashboardUi).toContain('className="is-metric"')
    expect(dashboardUi).toContain('className="is-num"')
  })
})
