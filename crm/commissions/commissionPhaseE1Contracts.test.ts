import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { MIGRATION_034_FILENAME } from '../security/migration034Contract'
import { MIGRATION_035_FILENAME } from '../security/migration035Contract'
import { MIGRATION_040_FILENAME } from '../security/migration040Contract'
import { MIGRATION_041_FILENAME } from '../security/migration041Contract'
import { MIGRATION_042_FILENAME } from '../security/migration042Contract'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')

const SHA_034 = '6c7ca04397e635231e95c9fe7e7461ff2814078e4e6e1ff1d42447c0c716fcb6'
const SHA_035 = '327294de173d5d36b3f66d949c5f6d436485f68bd0a54713c54dc43a4af8b537'
const SHA_040 = '73363299db1487c2bf4600f4a45d80725b2250c5c73bb618d78f4e3224ecd29a'
const SHA_041 = '1bbdeda6c3c8ecb8fcdc49e2ad6057708db6816d51699888afa922aa8c630b96'
const SHA_042 = '70de8f5a83b5222b6df7f4ab050bd1c3e8de8d75a65507dcd0cb527ebb24f7d3'
const SHA_046 = '2d0cf7323638ae50c55c9eca65d957c1a48b3035a7bdef251f009961338020fb'
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(root, relativePath))).digest('hex')
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('commission Phase E1 contracts', () => {
  it('does not add a commission 053 or change compensation schema', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(54)
    expect(numbered.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(numbered.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(numbered.filter((name) => name.startsWith('055_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '053_commission_eligible_released.sql'))).toBe(false)
    expect(sha256(`supabase/migrations/${MIGRATION_034_FILENAME}`)).toBe(SHA_034)
    expect(sha256(`supabase/migrations/${MIGRATION_035_FILENAME}`)).toBe(SHA_035)
    expect(sha256(`supabase/migrations/${MIGRATION_040_FILENAME}`)).toBe(SHA_040)
    expect(sha256(`supabase/migrations/${MIGRATION_041_FILENAME}`)).toBe(SHA_041)
    expect(sha256(`supabase/migrations/${MIGRATION_042_FILENAME}`)).toBe(SHA_042)
    expect(sha256('supabase/migrations/046_opportunity_case_conversion.sql')).toBe(SHA_046)
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })

  it('opens Record Payment from accepted_pending without a Pending→Paid status or new RPC', () => {
    const page = read('pages/crm/CrmCommissionsPage.tsx')
    const actions = read('crm/commissions/CommissionOwnerActions.tsx')
    const dialog = read('crm/commissions/RecordCommissionEventDialog.tsx')
    const writeApi = read('crm/commissions/commissionWriteApi.ts')
    const pendingPage = read('pages/crm/CrmCommissionsPendingImportPage.tsx')
    const pendingPanel = read('crm/commissions/pending/CommissionPendingReviewPanel.tsx')
    const pendingApi = read('crm/commissions/pending/commissionPendingApi.ts')
    expect(actions).toContain('RECORD_PAYMENT_ACTION_LABEL')
    expect(actions).toContain('canRecordPendingPayment(isOwner, item)')
    expect(page).toContain('fromPending: true')
    expect(page).toContain("lockedEventType: 'paid'")
    expect(page).toContain('recordPolicyWritingCommissionEvent')
    expect(page).toContain('createSupabaseBrowserClient')
    expect(page).not.toContain('createSupabaseAdminClient')
    expect(page).not.toContain('SERVICE_ROLE')
    expect(dialog).toContain('fromPending')
    expect(dialog).toContain('Paid amount')
    expect(dialog).toContain('PENDING_AMOUNT_IS_SUGGESTION_COPY')
    expect(dialog).not.toMatch(/\bEligible\b|\bReleased\b/)
    expect(writeApi).toContain('record_policy_writing_commission_event')
    expect(writeApi).not.toContain('post_commission_pending')
    expect(writeApi).not.toContain('review_commission_pending_import_row')
    expect(pendingPage).not.toContain('record_policy_writing_commission_event')
    expect(pendingApi).not.toContain('record_policy_writing_commission_event')
    expect(pendingPanel).toContain('acceptedPendingRecordPaymentPath')
    expect(pendingPanel).toContain('RECORD_PAYMENT_ACTION_LABEL')
    expect(pendingPanel).not.toContain('record_policy_writing_commission_event')
    expect(pendingPanel).not.toContain('Post to Ledger')
    expect(`${page}\n${writeApi}`).not.toMatch(/accepted_pending.status = ['"]paid['"]/)
  })

  it('keeps 035 issued→not_taken and ended-allocation posting rules unchanged', () => {
    const sql035 = read(`supabase/migrations/${MIGRATION_035_FILENAME}`)
    const sql041 = read(`supabase/migrations/${MIGRATION_041_FILENAME}`)
    const validateStart = sql035.indexOf(
      'CREATE OR REPLACE FUNCTION public.pp_writing_commission_validate_allocation',
    )
    const validateEnd = sql035.indexOf(
      'CREATE OR REPLACE FUNCTION public.pp_ensure_writing_commission_account',
    )
    const validateFn = sql035.slice(validateStart, validateEnd)
    expect(validateFn).not.toContain('effective_to')
    expect(sql035).toContain(
      "IF v_app.production_stage IN ('issued', 'in_force') OR v_has_policy THEN",
    )
    expect(sql035).not.toMatch(/not_taken/)
    expect(sql041).toContain('effective_to IS NULL')
    expect(sql041).toContain('Does not write 035')
  })

  it('does not add Eligible/Released, upline compensation, or RLS changes', () => {
    const payment = read('crm/commissions/commissionPendingPayment.ts')
    const dialog = read('crm/commissions/RecordCommissionEventDialog.tsx')
    const detail = read('crm/commissions/CommissionWorkItemDetail.tsx')
    const client = read('lib/supabase/client.ts')
    const sql034 = read(`supabase/migrations/${MIGRATION_034_FILENAME}`)
    const sql035 = read(`supabase/migrations/${MIGRATION_035_FILENAME}`)
    const sql040 = read(`supabase/migrations/${MIGRATION_040_FILENAME}`)
    const sql041 = read(`supabase/migrations/${MIGRATION_041_FILENAME}`)
    const sql042 = read(`supabase/migrations/${MIGRATION_042_FILENAME}`)
    expect(payment).not.toMatch(/upline|generational|override_rate/)
    expect(dialog).not.toMatch(/upline|generational/)
    expect(detail).toContain('PENDING_AND_PAID_COEXISTENCE_COPY')
    expect(detail).toContain('This is not Paid')
    expect(client).toContain('createBrowserClient')
    expect(client).not.toContain('SERVICE_ROLE')
    for (const sql of [sql034, sql035, sql040, sql041, sql042]) {
      expect(sql).not.toMatch(/ADD VALUE[^;]*'(eligible|released)'/)
      expect(sql).not.toContain('upline_id')
      expect(sql).not.toContain('generational_rate')
    }
  })
})
