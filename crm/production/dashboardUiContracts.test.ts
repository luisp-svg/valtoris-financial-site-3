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

const EXPECTED_MIGRATIONS = [
  '001_extensions_and_enums.sql',
  '002_profiles_roles_settings_audit.sql',
  '003_verticals_pipelines_stages.sql',
  '004_referral_sources_households_members_duplicates.sql',
  '005_leads_assessments_recommendations.sql',
  '006_opportunities_assignments.sql',
  '007_tasks_notes_activities.sql',
  '008_policies_appointments_reviews.sql',
  '009_documents_portal.sql',
  '010_rls_policies.sql',
  '011_seed_pipelines.sql',
  '012_secure_rpcs.sql',
  '013_storage_policies.sql',
  '014_security_hardening.sql',
  '015_member_relationship_enum_values.sql',
  '016_household_members_soft_delete_rpc.sql',
  '017_soft_delete_note_rpc.sql',
  '018_assessment_type_household_onboarding.sql',
  '019_assessment_lifecycle_status.sql',
  '020_public_family_diagnostic_ingest.sql',
  '021_public_family_duplicate_resolution.sql',
  '022_public_family_task_automation.sql',
  '023_confirm_same_allows_ingest_resolve_task.sql',
  '024_authenticated_crm_privileges_and_duplicate_notes_fix.sql',
  '025_digital_identity_cards.sql',
  '026_digital_identity_connect_ingest.sql',
  '027_digital_identity_relationship_photo.sql',
  '028_digital_identity_campaign_attribution.sql',
  '029_security_hardening_opportunities_and_relationships.sql',
  '030_revoke_authenticated_activity_inserts.sql',
  '031_quick_add_contact_foundation.sql',
  '032_policy_production_foundation.sql',
  '033_writing_advisor_compensation_foundation.sql',
  '034_writing_advisor_expected_compensation.sql',
  '035_writing_advisor_actual_commission_ledger.sql',
  '036_commission_import_reconciliation.sql',
  '037_client_production_workflow_extensions.sql',
  '038_historical_import_support.sql',
  '039_commission_import_review_post_hardening.sql',
  '040_commission_pending_import.sql',
  '041_commission_pending_review.sql',
  '042_writing_receivable_eligibility.sql',
  '043_public_report_card_ingest.sql',
  '044_policy_application_requirements.sql',
]

describe('Phase A production dashboard contracts', () => {
  it('does not add a production dashboard or Case table migration and leaves 001–044 as the migration set', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toEqual(EXPECTED_MIGRATIONS)
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
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
    expect(queuePage).toContain('productionListCapWarning')
    expect(queuePage).toContain('PRODUCTION_LIST_DEFAULT_LIMIT')
    expect(queuePage).toContain('DEFAULT_PRODUCTION_DASHBOARD_PERIOD')
    expect(queuePage).toContain('DEFAULT_COMPENSATION_DASHBOARD_PERIOD')
    expect(queuePage).not.toMatch(/useEffect\([\s\S]*, \[[^\]]*productionPeriod/)
    expect(queuePage).not.toMatch(/useEffect\([\s\S]*, \[[^\]]*compensationPeriod/)
    expect(dashboardUi).toContain('Annual Life Premium')
    expect(dashboardUi).toContain('Advisor Compensation')
    expect(dashboardUi).toContain('Outstanding')
    expect(dashboardUi).toContain('Chargebacks')
    expect(dashboardUi).toContain('Net Paid')
    expect(dashboardUi).toContain('not a production stage')
    expect(dashboardUi).toContain('Active Life Protection')
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
  })
})
