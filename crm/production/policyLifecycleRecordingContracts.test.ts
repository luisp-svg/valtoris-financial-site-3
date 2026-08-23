import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { POLICY_LIFECYCLE_CHARGEBACK_NOTE } from './policyLifecycle'
import { POLICY_LIFECYCLE_RPC } from './policyLifecycleApi'
import { RECORD_POST_PLACEMENT_ACTION_LABEL } from './policyLifecycleView'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const section = readFileSync(join(here, 'PolicyLifecycleSection.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'RecordPostPlacementOutcomeDialog.tsx'), 'utf8')
const api = readFileSync(join(here, 'policyLifecycleApi.ts'), 'utf8')
const view = readFileSync(join(here, 'policyLifecycleView.ts'), 'utf8')
const errors = readFileSync(join(here, 'policyLifecycleErrors.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const editForm = readFileSync(join(here, 'ApplicationEditForm.tsx'), 'utf8')
const editPage = readFileSync(join(here, '../../pages/crm/CrmProductionEditPage.tsx'), 'utf8')
const editView = readFileSync(join(here, 'applicationEditView.ts'), 'utf8')
const commissionWrite = readFileSync(join(here, '../commissions/commissionWriteApi.ts'), 'utf8')
const compensationApi = readFileSync(join(here, 'compensationApi.ts'), 'utf8')
const types = readFileSync(join(here, 'types.ts'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const sql045 = readFileSync(join(migrationsDir, '045_policy_post_placement_lifecycle.sql'), 'utf8')

describe('post-placement recording UI contracts', () => {
  it('does not add Migration 047 and keeps 045 as the only lifecycle writer', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(49)
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
    expect(files.filter((name) => name.startsWith('050_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '047_policy_lifecycle_recording.sql'))).toBe(false)
    expect(sql045).toContain('CREATE OR REPLACE FUNCTION public.record_policy_post_placement_outcome')
    expect(POLICY_LIFECYCLE_RPC).toBe('record_policy_post_placement_outcome')
    expect(api).toContain('POLICY_LIFECYCLE_RPC')
    expect(api).toContain('supabase.rpc(')
  })

  it('places the owner action on Case Detail Policy Lifecycle, not Edit Application', () => {
    expect(detailPage).toContain('PolicyLifecycleSection')
    expect(detailPage).toContain('onSaved={() => setReloadKey((n) => n + 1)}')
    expect(section).toContain('Policy Lifecycle')
    expect(section).toContain('canRecordPostPlacementForApplication')
    expect(section).toContain('RECORD_POST_PLACEMENT_ACTION_LABEL')
    expect(section).toContain('recordPolicyPostPlacementOutcome')
    expect(section).toContain('onSaved()')
    expect(RECORD_POST_PLACEMENT_ACTION_LABEL).toBe('Record canceled or surrendered')
    expect(editForm).not.toContain('record_policy_post_placement_outcome')
    expect(editForm).not.toContain('RecordPostPlacementOutcomeDialog')
    expect(editPage).not.toContain('recordPolicyPostPlacementOutcome')
    expect(editView).toContain("'draft'")
    expect(editView).toContain("'in_underwriting'")
    expect(editView).not.toContain("'in_force'")
    expect(queuePage).not.toContain('recordPolicyPostPlacementOutcome')
  })

  it('keeps the write control owner-only and advisors on the existing read model', () => {
    expect(view).toContain("if (options.role !== 'owner') return false")
    expect(view).toContain("options.productionStage !== 'in_force'")
    expect(view).toContain("linkedPolicyStatus === 'in_force'")
    expect(section).toContain('canRecordPostPlacementForApplication(role, application)')
    expect(section).toContain('canRecord ? (')
    expect(dialog).toContain('POST_PLACEMENT_OUTCOMES.map')
    expect(dialog).toContain('formatPostPlacementOutcomeLabel')
    expect(dialog).toContain('Termination date (optional)')
    expect(dialog).toContain('Termination reason')
    expect(dialog).toContain('required')
  })

  it('does not reproduce 12-month classification in the browser draft/view', () => {
    expect(view).not.toMatch(/12 month|12-month|anniversary/i)
    expect(view).not.toContain('interval')
    expect(errors).toContain('12-month placement anniversary')
    expect(dialog).toContain('Leave blank if the exact day is unknown.')
    expect(dialog).toContain('the server checks it')
    expect(dialog).toContain('against the selected outcome.')
  })

  it('refreshes Case Detail through the existing production read after a successful write', () => {
    expect(section).toContain('onSaved()')
    expect(detailPage).toContain('fetchProductionApplicationById')
    expect(detailPage).toContain('[applicationId, reloadKey]')
    expect(productionApi).toContain('terminated_on')
    expect(productionApi).toContain('termination_reason')
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
  })

  it('does not mutate commissions, expected compensation, opportunities, or activities', () => {
    const writerBlob = `${api}\n${section}\n${dialog}\n${view}`
    expect(writerBlob).not.toContain('record_policy_writing_commission_event')
    expect(writerBlob).not.toContain('pp_refresh_application_expected_compensation')
    expect(writerBlob).not.toContain('set_policy_application_writing_receivable_expected')
    expect(writerBlob).not.toContain('move_opportunity_stage')
    expect(writerBlob).not.toContain('record_crm_activity')
    expect(writerBlob).not.toMatch(/from\('activities'\)/)
    expect(writerBlob).not.toMatch(/from\('policies'\)[\s\S]*\.update/)
    expect(commissionWrite).not.toContain('record_policy_post_placement_outcome')
    expect(compensationApi).not.toContain('record_policy_post_placement_outcome')
    expect(applicationApi).not.toContain('record_policy_post_placement_outcome')
    expect(section).toContain('POLICY_LIFECYCLE_CHARGEBACK_NOTE')
    expect(dialog).toContain('POLICY_LIFECYCLE_CHARGEBACK_NOTE')
    expect(POLICY_LIFECYCLE_CHARGEBACK_NOTE).toContain(
      'does not indicate whether a commission chargeback occurred',
    )
    expect(types).not.toMatch(/PRODUCTION_STAGES = \[[^\]]*canceled/s)
    expect(types).not.toMatch(/PRODUCTION_STAGES = \[[^\]]*surrendered/s)
  })

  it('does not add a Vercel function, service-role client, or second lifecycle store', () => {
    expect(api).not.toContain('SERVICE_ROLE')
    expect(section).not.toContain('SERVICE_ROLE')
    expect(detailPage).not.toContain('SERVICE_ROLE')
    expect(detailPage).not.toContain('/api/')
    expect(section).not.toContain('/api/')
    expect(api).not.toContain('createClient')
    expect(existsSync(join(here, '../../api/policy-lifecycle.ts'))).toBe(false)
  })

  it('keeps 44px targets and stacks the dialog at 393px without page overflow', () => {
    expect(styles).toContain('.crm-policy-lifecycle-actions')
    expect(styles).toContain('.crm-policy-lifecycle-dialog')
    expect(styles).toContain('.crm-policy-lifecycle-actions .crm-primary-btn')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('@media (max-width: 393px)')
    expect(styles).toContain('.crm-policy-lifecycle-dialog .crm-form-actions')
    expect(dialog).toContain('crm-policy-lifecycle-dialog')
    expect(dialog).toContain('crm-radio-field')
    expect(styles).toContain('overflow-x: clip')
  })
})
