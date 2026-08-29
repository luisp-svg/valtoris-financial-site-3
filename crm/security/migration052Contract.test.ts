import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'
import { MIGRATION_048_FILENAME } from './migration048Contract'
import { MIGRATION_049_FILENAME } from './migration049Contract'
import { MIGRATION_050_FILENAME } from './migration050Contract'
import {
  MIGRATION_051_FILENAME,
  MIGRATION_051_RPC,
} from './migration051Contract'
import {
  MIGRATION_052_CONTRACT_MARKERS,
  MIGRATION_052_FILENAME,
  MIGRATION_052_FORBIDDEN_MARKERS,
  MIGRATION_052_RPC,
} from './migration052Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql051 = readFileSync(resolve(migrationsDir, MIGRATION_051_FILENAME), 'utf8')
const sql052 = readFileSync(resolve(migrationsDir, MIGRATION_052_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

function createReplaceCount(sql: string, name: string): number {
  return (sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'g')) ?? []).length
}

describe('migration 052 Intake archive Activity ordering fix', () => {
  it('is the only 052 file, follows 051, freezes 001–052, and is followed by 053, and rejects 054', () => {
    expect(MIGRATION_052_FILENAME).toBe('052_fix_intake_archive_activity_order.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(53)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe(MIGRATION_049_FILENAME)
    expect(files[49]).toBe(MIGRATION_050_FILENAME)
    expect(files[50]).toBe(MIGRATION_051_FILENAME)
    expect(files[51]).toBe(MIGRATION_052_FILENAME)
    expect(files.filter((f) => f.startsWith('051_'))).toEqual([MIGRATION_051_FILENAME])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual([MIGRATION_052_FILENAME])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual([])
  })

  it('replaces archive_intake_lead only and keeps the approved signature', () => {
    expect(MIGRATION_052_RPC).toBe(MIGRATION_051_RPC)
    expect(MIGRATION_052_RPC).toBe('archive_intake_lead')
    expect((sql052.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(1)
    expect(createReplaceCount(sql052, MIGRATION_052_RPC)).toBe(1)
    expect(sql052).toContain('archive_intake_lead(\n  p_lead_id uuid,\n  p_reason text\n)')
    expect(sql052).not.toContain('p_household_id')
    expect(sql052).not.toContain('CREATE FUNCTION')
    expect(sql052).not.toContain('archive_intake_lead_v2')
    for (const marker of MIGRATION_052_CONTRACT_MARKERS) {
      expect(sql052).toContain(marker)
    }
  })

  it('writes the Intake archived Activity before leads.deleted_at and still references the lead', () => {
    const activityAt = sql052.indexOf('PERFORM public.crm_write_activity(')
    const leadUpdateAt = sql052.indexOf('UPDATE public.leads')
    const deletedAt = sql052.lastIndexOf('SET deleted_at = now()')
    expect(activityAt).toBeGreaterThan(0)
    expect(leadUpdateAt).toBeGreaterThan(activityAt)
    expect(deletedAt).toBeGreaterThan(activityAt)
    const activityBlock = sql052.slice(activityAt, activityAt + 450)
    expect(activityBlock).toContain('v_lead.id')
    expect(activityBlock).toContain("'Intake archived'")
    expect(activityBlock).toContain("'system'::public.activity_type")
    expect(sql052).not.toMatch(/UPDATE public\.leads[\s\S]{0,400}PERFORM public\.crm_write_activity/)
  })

  it('keeps 051 archive semantics and does not add tables, delete, Opportunity, or Sheets writes', () => {
    expect(sql052).toContain('CRM_INTAKE:duplicate_review_pending')
    expect(sql052).toContain("'review_initial_diagnostic'")
    expect(sql052).toContain("'review_digital_identity_lead'")
    expect(sql052).toContain("'resolve_possible_duplicate'")
    expect(sql052).toContain("'resolve_digital_identity_duplicate'")
    expect(sql052).toContain('public.crm_is_owner()')
    expect(sql052).toContain('GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO authenticated')
    expect(sql052).not.toContain('crm_advisors_can_view_unassigned')
    for (const marker of MIGRATION_052_FORBIDDEN_MARKERS) {
      expect(sql052).not.toContain(marker)
    }
    expect((sql052.match(/PERFORM public\.crm_write_activity\(/g) ?? []).length).toBe(1)
  })

  it('does not modify Migrations 047–051', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sha256(`supabase/migrations/${MIGRATION_049_FILENAME}`)).toBe(SHA_049)
    expect(sha256(`supabase/migrations/${MIGRATION_050_FILENAME}`)).toBe(SHA_050)
    expect(sha256(`supabase/migrations/${MIGRATION_051_FILENAME}`)).toBe(SHA_051)
    expect(sha256(`supabase/migrations/${MIGRATION_052_FILENAME}`)).toBe(SHA_052)
    expect(sql051).toContain('SET deleted_at = now()')
    expect(sql051.indexOf('UPDATE public.leads')).toBeLessThan(sql051.indexOf('PERFORM public.crm_write_activity('))
  })
})
