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

describe('commission Phase E2 contracts', () => {
  it('does not add a commission 053, Eligible, Released, or a persisted reconciliation status', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name)).sort()
    expect(numbered).toHaveLength(53)
    expect(numbered.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(numbered.filter((name) => name.startsWith('054_'))).toEqual([])
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

  it('is read-model only: no Mark Reconciled, no new write RPC, Pending and 035 stay separate', () => {
    const exceptionView = read('crm/commissions/commissionExceptionView.ts')
    const filters = read('crm/commissions/commissionFilters.ts')
    const workspace = read('crm/commissions/CommissionWorkspace.tsx')
    const summary = read('crm/commissions/CommissionSummary.tsx')
    const detail = read('crm/commissions/CommissionWorkItemDetail.tsx')
    const actions = read('crm/commissions/CommissionOwnerActions.tsx')
    const page = read('pages/crm/CrmCommissionsPage.tsx')
    const writeApi = read('crm/commissions/commissionWriteApi.ts')
    const e2 = `${exceptionView}\n${filters}\n${workspace}\n${summary}\n${detail}`
    expect(e2).not.toMatch(/Mark Reconciled|Mark Eligible|Mark Released|needs_attention\s*=/)
    expect(e2).not.toMatch(/reconciled\s*=\s*true/)
    expect(exceptionView).toContain('Does not persist statuses')
    expect(exceptionView).toContain('remaining_expected_cents === 0')
    expect(workspace).toContain('Exception')
    expect(workspace).toContain('visibleExceptionBuckets(isOwner)')
    expect(summary).toContain('Net actual')
    expect(summary).not.toContain('label="Net Paid"')
    expect(detail).toContain('Reconciliation')
    expect(detail).toContain('Exceptions')
    expect(detail).toContain('aria-label="Activity"')
    expect(actions).toContain('RECORD_PAYMENT_ACTION_LABEL')
    expect(actions).not.toMatch(/Mark Reconciled|Resolve exception|Dismiss variance/)
    expect(writeApi).toContain('record_policy_writing_commission_event')
    expect(writeApi).not.toContain('mark_commission_reconciled')
    expect(page).toContain('createSupabaseBrowserClient')
    expect(page).not.toContain('createSupabaseAdminClient')
    expect(page).not.toContain('SERVICE_ROLE')
    expect(page).toContain('filterCommissionWorkItems(workItems, filters, period, today, { isOwner })')
  })

  it('keeps Pending owner-only, unattributed owner-only, and advisors on derived reconciliation', () => {
    const workspace = read('crm/commissions/CommissionWorkspace.tsx')
    const exceptionView = read('crm/commissions/commissionExceptionView.ts')
    const page = read('pages/crm/CrmCommissionsPage.tsx')
    expect(exceptionView).toContain('OWNER_ONLY_EXCEPTION_BUCKETS')
    expect(exceptionView).toContain("'attribution_review'")
    expect(exceptionView).toContain("'pending_without_actual'")
    expect(workspace).toContain('visibleExceptionBuckets(isOwner)')
    expect(workspace).toContain('isOwner && pendingError')
    expect(page).toContain('? fetchCommissionPendingDashboardSource')
    expect(page).toContain('summarizeUnattributedCommission')
    expect(`${workspace}\n${exceptionView}`).not.toMatch(/upline|generational/)
  })

  it('does not change 035 issued→not_taken, ended-allocation, chargeback cap, or RLS', () => {
    const sql035 = read(`supabase/migrations/${MIGRATION_035_FILENAME}`)
    const sql041 = read(`supabase/migrations/${MIGRATION_041_FILENAME}`)
    const client = read('lib/supabase/client.ts')
    const exceptionView = read('crm/commissions/commissionExceptionView.ts')
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
    expect(exceptionView).not.toMatch(/chargeback.*cap|capChargeback|MAX_CHARGEBACK/i)
    expect(client).toContain('createBrowserClient')
    expect(client).not.toContain('SERVICE_ROLE')
    expect(exceptionView).not.toContain('POLICY')
    expect(exceptionView).not.toContain('ALTER TABLE')
  })
})
