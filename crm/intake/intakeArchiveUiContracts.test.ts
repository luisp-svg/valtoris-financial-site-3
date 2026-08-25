import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS } from '../security/migration045Contract'
import { MIGRATION_051_FILENAME } from '../security/migration051Contract'
import { INTAKE_ARCHIVE_REASON_OPTIONS } from './intakeArchiveUi'

const root = resolve(process.cwd())
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

const page = read('pages/crm/CrmIntakePage.tsx')
const panel = read('crm/intake/IntakeDetailPanel.tsx')
const dialog = read('crm/intake/IntakeArchiveConfirmDialog.tsx')
const wrapper = read('crm/intake/intakeArchive.ts')
const ui = read('crm/intake/intakeArchiveUi.ts')
const intakeApi = read('crm/intake/intakeApi.ts')
const duplicateDialog = read('crm/intake/DuplicateResolutionConfirmDialog.tsx')
const opportunitiesApi = read('crm/opportunities/opportunitiesApi.ts')
const familyIngest = read('server/ingest/familyReportCard/ingestFamilyReportCard.ts')
const creditCatalog = read('modules/reportCard/publicIngestCatalog.ts')

describe('Intake archive UI contracts', () => {
  it('places Archive / Dismiss on the existing Intake detail as a secondary action', () => {
    expect(page).toContain('import IntakeDetailPanel from')
    expect(page).toContain('import IntakeArchiveConfirmDialog from')
    expect(page).toContain('archiveIntakeLead(supabase, {')
    expect(page).toContain('leadId: selectedItem.leadId')
    expect(page).toContain('INTAKE_ARCHIVE_SUCCESS_COPY')
    expect(page).toContain('setReloadToken((token) => token + 1)')
    expect(page).not.toContain('navigate(')
    expect(panel).toContain('INTAKE_ARCHIVE_ACTION_LABEL')
    expect(panel).toContain('platform-btn-primary')
    expect(panel).toContain('Open household')
    expect(panel).toContain('canPresentArchive')
    expect(panel).toContain('archiveBlockedByDuplicate')
    expect(panel).toContain('INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY')
    expect(panel).not.toMatch(/>\s*Delete\s*</)
    expect(page).not.toMatch(/>\s*Delete\s*</)
    expect(dialog).not.toMatch(/Delete/)
  })

  it('keeps Archive role-aware and does not treat unassigned-pool visibility as permission', () => {
    expect(ui).toContain('if (input.isOwner) return true')
    expect(ui).toContain('currentAdvisorProfileId === input.leadAssignedAdvisorId')
    expect(ui).toContain('currentAdvisorProfileId === input.householdAssignedAdvisorId')
    expect(page).toContain('intakeArchiveVisibilityForItem(selectedItem, {')
    expect(page).toContain("isOwner: role === 'owner'")
    expect(page).toContain('currentAdvisorProfileId: advisorProfileId')
    expect(ui).not.toContain('crm_advisors_can_view_unassigned')
    expect(page).not.toContain('crm_advisors_can_view_unassigned')
  })

  it('uses exactly four canonical archive reasons and confirmation copy', () => {
    expect(INTAKE_ARCHIVE_REASON_OPTIONS).toHaveLength(4)
    expect(dialog).toContain('INTAKE_ARCHIVE_REASON_OPTIONS.map')
    expect(dialog).toContain("type=\"radio\"")
    expect(dialog).toContain('INTAKE_ARCHIVE_CONFIRM_COPY')
    expect(dialog).toContain('Archive Intake')
    expect(dialog).toContain('submitting || !reason')
    expect(dialog).toContain("{submitting ? 'Archiving…' : 'Archive Intake'}")
    expect(ui).toContain("value: 'dismissed'")
    expect(ui).toContain("value: 'not_a_fit'")
    expect(ui).toContain("value: 'spam'")
    expect(ui).toContain("value: 'test_or_accidental'")
  })

  it('prevents double submit and keeps the Intake open on server errors', () => {
    expect(page).toContain('if (!selectedItem || archivingRef.current) return')
    expect(page).toContain('archivingRef.current = true')
    expect(page).toContain('setArchiveDialogError(result.message)')
    expect(page).toContain('if (archiving) return')
    expect(page).not.toContain('setItems((current) => current.filter')
    expect(page).toContain('fetchIntakeQueueSafe')
  })
})

describe('Intake archive isolation contracts', () => {
  it('calls only the archive RPC and never mutates leads, tasks, or Activity from the browser', () => {
    expect(wrapper).toContain("supabase.rpc(INTAKE_ARCHIVE_RPC, {")
    expect(wrapper).toContain('p_lead_id: input.leadId')
    expect(wrapper).toContain('p_reason: input.reason')
    expect(wrapper).not.toContain('.from(')
    expect(wrapper).not.toContain('deleted_at')
    expect(wrapper).not.toContain('record_crm_activity')
    expect(wrapper).not.toContain('crm_write_activity')
    expect(wrapper).not.toContain('SERVICE_ROLE')
    expect(wrapper).not.toContain('createSupabaseAdmin')
    expect(page).not.toContain("from('leads')")
    expect(page).not.toContain("from('tasks')")
    expect(page).not.toContain("from('activities')")
    expect(page).not.toContain('record_crm_activity')
    expect(panel).not.toContain("from('tasks')")
    expect(panel).not.toContain("from('activities')")
    expect(dialog).not.toContain("from('")
  })

  it('does not write Sheets, Opportunity, or duplicate-resolution from archive', () => {
    expect(wrapper).not.toContain('sheets')
    expect(wrapper).not.toContain('move_opportunity_stage')
    expect(wrapper).not.toContain('create_opportunity')
    expect(page).not.toContain('writeFamilyReportCardToSheets')
    expect(page).not.toContain('createOpportunity')
    expect(page).not.toContain('assign_household')
    expect(page).toContain('resolveDuplicateReview')
    expect(page).toContain('resolveDigitalIdentityDuplicateReview')
    expect(duplicateDialog).toContain('Confirm Same Household')
    expect(opportunitiesApi).toContain('export async function createOpportunity')
  })

  it('keeps fetchIntakeQueue filtering deleted_at IS NULL and leaves ingest unchanged', () => {
    expect(intakeApi).toContain(".is('deleted_at', null)")
    expect(intakeApi).toContain('.in(\'lead_type\'')
    expect(familyIngest).toContain('export async function ingestPublicReportCard')
    expect(familyIngest).not.toContain('archive_intake_lead')
    expect(creditCatalog).toContain("'Credit Report Card'")
    expect(creditCatalog).not.toContain('credit_repair')
    expect(page).not.toContain('credit_repair')
  })
})

describe('Intake archive migration freeze', () => {
  it('leaves migrations 047–051 unchanged and freezes through 052', () => {
    const migrationsDir = resolve(root, 'supabase/migrations')
    const files = readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .sort()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(existsSync(resolve(migrationsDir, '052_intake_archive_ui.sql'))).toBe(false)
    expect(files.filter((name) => name.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual([])
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256(`supabase/migrations/${MIGRATION_051_FILENAME}`)).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
  })
})
