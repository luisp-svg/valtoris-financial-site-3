import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')

function read(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('chargeback recording contracts', () => {
  it('reuses the existing 035 writer and does not add a chargeback Migration 048', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(51)
    expect(numbered.filter((name) => name.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(numbered.filter((name) => name.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(numbered.filter((name) => name.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(numbered.filter((name) => name.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(numbered.filter((name) => name.startsWith('052_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '047_commission_chargeback.sql'))).toBe(false)
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
    const api = read('commissionWriteApi.ts')
    expect(page).toContain("openRecord(item, false, 'chargeback')")
    expect(page).toContain('recordPolicyWritingCommissionEvent')
    expect(page).not.toContain('from(\'policy_writing_commission_events\')')
    expect(api).toContain('record_policy_writing_commission_event')
    expect(api).not.toMatch(/\.insert\s*\(/)
    expect(api).not.toMatch(/\.update\s*\(/)
    expect(api).not.toMatch(/\.delete\s*\(/)
    expect(api).not.toContain('SERVICE_ROLE')
  })

  it('exposes Record Chargeback on /crm/commissions for owners only', () => {
    const actions = read('CommissionOwnerActions.tsx')
    const dialog = read('RecordCommissionEventDialog.tsx')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
    const production = readFileSync(join(root, 'pages/crm/CrmProductionPage.tsx'), 'utf8')
    const productionDetail = readFileSync(join(root, 'pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
    const lifecycleDialog = readFileSync(
      join(root, 'crm/production/RecordPostPlacementOutcomeDialog.tsx'),
      'utf8',
    )
    expect(actions).toContain('RECORD_CHARGEBACK_ACTION_LABEL')
    expect(actions).toContain('canRecordChargeback(isOwner, item)')
    expect(dialog).toContain("lockedEventType === 'chargeback'")
    expect(dialog).toContain('Record Chargeback')
    expect(dialog).toContain('CHARGEBACK_LIFECYCLE_NOTE')
    expect(page).toContain('role === \'owner\'')
    expect(production).not.toContain('Record Chargeback')
    expect(productionDetail).not.toContain('Record Chargeback')
    expect(lifecycleDialog).not.toContain('Record Chargeback')
    expect(lifecycleDialog).not.toContain('record_policy_writing_commission_event')
  })

  it('does not couple chargebacks to policy lifecycle, opportunity, tasks, or expected compensation', () => {
    const dialog = read('RecordCommissionEventDialog.tsx')
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
    const writeApi = read('commissionWriteApi.ts')
    const lifecycleApi = readFileSync(join(root, 'crm/production/policyLifecycleApi.ts'), 'utf8')
    expect(dialog).not.toContain('record_policy_post_placement_outcome')
    expect(page).not.toContain('record_policy_post_placement_outcome')
    expect(writeApi).not.toContain('record_policy_post_placement_outcome')
    expect(writeApi).not.toContain('create_task')
    expect(writeApi).not.toContain('crm_activities')
    expect(writeApi).not.toContain('assign_opportunity')
    expect(writeApi).not.toContain('writing_receivable_expected')
    expect(writeApi).not.toContain('expected_compensation_cents')
    expect(lifecycleApi).not.toContain('record_policy_writing_commission_event')
    expect(lifecycleApi).not.toContain('chargeback')
    expect(dialog).not.toMatch(/upline|generational|override commission/i)
    expect(read('commissionWriteView.ts')).not.toMatch(/upline|generational|override commission/i)
  })

  it('keeps pending review and adjustments separate from the chargeback writer', () => {
    const page = readFileSync(join(root, 'pages/crm/CrmCommissionsPage.tsx'), 'utf8')
    const dialog = read('RecordCommissionEventDialog.tsx')
    const filters = read('commissionFilters.ts')
    const workspace = read('CommissionWorkspace.tsx')
    expect(page).not.toContain('review_commission_pending_import_row')
    expect(page).not.toContain('post_commission_import_row')
    expect(dialog).not.toContain('Pending Review')
    expect(dialog).not.toMatch(/\bEligible\b|\bReleased\b/)
    expect(filters).toContain("moneyKind: CommissionMoneyKindFilter")
    expect(filters).toContain("'chargeback'")
    expect(workspace).toContain('Ledger activity')
    expect(workspace).toContain('commissionMoneyKindFilterLabel')
  })

  it('shows chargeback review from existing work-item totals and event history', () => {
    const detail = read('CommissionWorkItemDetail.tsx')
    expect(detail).toContain('crm-commissions-chargeback-review')
    expect(detail).toContain('chargebackReviewTotals(item)')
    expect(detail).toContain("eventsOfType(allEvents, 'paid')")
    expect(detail).toContain("eventsOfType(allEvents, 'chargeback')")
    expect(detail).not.toContain('reversed_event_id === paid')
    expect(detail).not.toContain('chargeback_status')
  })
})
