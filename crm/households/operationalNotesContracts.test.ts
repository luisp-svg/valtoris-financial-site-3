import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const card = readFileSync(join(here, '../production/ProductionBoardCard.tsx'), 'utf8')
const board = readFileSync(join(here, '../production/ProductionBoard.tsx'), 'utf8')
const panel = readFileSync(join(here, 'OperationalNotesPanel.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'OperationalNotesDialog.tsx'), 'utf8')
const composer = readFileSync(join(here, 'HouseholdNoteComposer.tsx'), 'utf8')
const notesApi = readFileSync(join(here, 'notesApi.ts'), 'utf8')
const notesTab = readFileSync(join(here, 'ClientWorkspace/tabs/NotesTab.tsx'), 'utf8')
const workspace = readFileSync(join(here, 'ClientWorkspace/index.tsx'), 'utf8')
const tabConfig = readFileSync(join(here, 'ClientWorkspace/tabConfig.ts'), 'utf8')
const browserClient = readFileSync(join(here, '../../lib/supabase/client.ts'), 'utf8')
const migrationsDir = join(here, '../../supabase/migrations')

describe('Phase B.5 operational notes contracts', () => {
  it('reuses household notes APIs and loads notes only when the panel mounts', () => {
    expect(panel).toContain('fetchHouseholdNotes(supabase, householdId)')
    expect(composer).toContain('createHouseholdNote')
    expect(panel).toContain('HouseholdNoteComposer')
    expect(dialog).toContain('OperationalNotesPanel')
    expect(card).not.toContain('fetchHouseholdNotes')
    expect(board).not.toContain('fetchHouseholdNotes')
    expect(queuePage).not.toContain('fetchHouseholdNotes')
    expect(queuePage).toContain('notesTarget')
    expect(queuePage).toContain('OperationalNotesDialog')
    expect(queuePage).toMatch(/notesTarget \? \(/)
  })

  it('scopes notes to application.household_id and labels them as household notes', () => {
    expect(card).toContain('householdId: item.household_id')
    expect(detailPage).toContain('householdId={application.household_id}')
    expect(detailPage).toContain('OperationalNotesPanel')
    expect(dialog).toContain('Operational Notes — {householdName}')
    expect(panel).toContain('Private household notes — not policy-specific.')
    expect(notesTab).toContain('Operational Notes')
    expect(tabConfig).toContain("label: 'Operational Notes'")
    expect(tabConfig).toContain("id: 'notes'")
  })

  it('authors notes from the authenticated CRM profile only', () => {
    expect(queuePage).toContain('crmNoteAuthorUserId(profile)')
    expect(detailPage).toContain('crmNoteAuthorUserId(profile)')
    expect(workspace).toContain('authorUserId={profile.id}')
    expect(notesTab).toContain('crmNoteAuthorUserId({ id: authorUserId })')
    expect(panel).not.toMatch(/<select[\s\S]*author/)
    expect(dialog).not.toMatch(/<select[\s\S]*author/)
    expect(composer).not.toMatch(/<select/)
    expect(notesTab).not.toMatch(/<select[\s\S]*author/)
  })

  it('creates a new internal household note row without fake application FKs', () => {
    expect(notesApi).toContain("visibility: 'internal'")
    expect(notesApi).toContain('author_user_id: authorUserId')
    expect(notesApi).toContain('.eq(\'household_id\', householdId)')
    expect(notesApi).toContain(".order('created_at', { ascending: false })")
    expect(notesApi).not.toContain('application_id')
    expect(composer).not.toContain('opportunity_id')
    expect(panel).not.toContain('opportunity_id')
    expect(panel).not.toContain('application_id')
    expect(detailPage).not.toMatch(/application\.notes\s*=/)
    expect(detailPage).not.toMatch(/update\(.*notes/)
    expect(queuePage).not.toContain("from('activities')")
    expect(panel).not.toContain("from('activities')")
    expect(composer).not.toContain("from('activities')")
  })

  it('does not expose notes publicly or use the service role in the browser', () => {
    expect(browserClient).toContain('anonKey')
    expect(browserClient).not.toContain('SERVICE_ROLE')
    expect(panel).not.toContain('SERVICE_ROLE')
    expect(dialog).not.toContain('SERVICE_ROLE')
    expect(composer).not.toContain('SERVICE_ROLE')
    expect(notesApi).not.toContain('SERVICE_ROLE')
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(detailPage).not.toContain('SERVICE_ROLE')
    expect(readFileSync(join(here, '../../components/SiteHeader.tsx'), 'utf8')).not.toContain(
      'fetchHouseholdNotes',
    )
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))
    expect(files).toContain('039_commission_import_review_post_hardening.sql')
    expect(existsSync(join(migrationsDir, '039_notes_application_id.sql'))).toBe(false)
  })
})
