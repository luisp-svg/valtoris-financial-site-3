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
import { MIGRATION_051_FILENAME, MIGRATION_051_INTAKE_LEAD_TYPES } from './migration051Contract'
import { MIGRATION_052_FILENAME } from './migration052Contract'
import {
  MIGRATION_053_ARCHIVE_RPC,
  MIGRATION_053_CONTRACT_MARKERS,
  MIGRATION_053_FILENAME,
  MIGRATION_053_FORBIDDEN_MARKERS,
  MIGRATION_053_HELPERS,
  MIGRATION_053_INTAKE_LEAD_TYPES,
  MIGRATION_053_RPC,
} from './migration053Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql052 = readFileSync(resolve(migrationsDir, MIGRATION_052_FILENAME), 'utf8')
const sql053 = readFileSync(resolve(migrationsDir, MIGRATION_053_FILENAME), 'utf8')

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

describe('migration 053 owner-only bulk lead import writer', () => {
  it('is the only 053 file, follows 052, freezes 001–054, and rejects 055', () => {
    expect(MIGRATION_053_FILENAME).toBe('053_bulk_lead_import_writer.sql')
    expect(MIGRATION_053_RPC).toBe('import_bulk_lead_consumer')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(54)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe(MIGRATION_049_FILENAME)
    expect(files[49]).toBe(MIGRATION_050_FILENAME)
    expect(files[50]).toBe(MIGRATION_051_FILENAME)
    expect(files[51]).toBe(MIGRATION_052_FILENAME)
    expect(files[52]).toBe(MIGRATION_053_FILENAME)
    expect(files.filter((f) => f.startsWith('052_'))).toEqual([MIGRATION_052_FILENAME])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual([MIGRATION_053_FILENAME])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('055_'))).toEqual([])
  })

  it('adds the writer RPC, internal match helpers, and a narrow archive_intake_lead replace', () => {
    expect(createReplaceCount(sql053, MIGRATION_053_RPC)).toBe(1)
    expect(createReplaceCount(sql053, MIGRATION_053_ARCHIVE_RPC)).toBe(1)
    for (const helper of MIGRATION_053_HELPERS) {
      expect(createReplaceCount(sql053, helper)).toBe(1)
    }
    expect((sql053.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(4)
    expect(sql053).not.toContain('CREATE FUNCTION')
    expect(sql053).not.toContain('import_bulk_lead_consumer_v2')
    expect(sql053).not.toContain('archive_intake_lead_v2')
    expect(MIGRATION_053_INTAKE_LEAD_TYPES).toEqual([...MIGRATION_051_INTAKE_LEAD_TYPES, 'Bulk Lead Import'])
    for (const marker of MIGRATION_053_CONTRACT_MARKERS) {
      expect(sql053).toContain(marker)
    }
  })

  it('is owner-only, denies anon, and does not add persistence or side-effect writes', () => {
    expect(sql053).toContain('PERFORM public.pp_assert_owner()')
    expect(sql053).toContain('GRANT EXECUTE ON FUNCTION public.import_bulk_lead_consumer(jsonb) TO authenticated')
    expect(sql053).toContain('REVOKE ALL ON FUNCTION public.import_bulk_lead_consumer(jsonb) FROM anon')
    expect(sql053).not.toContain('GRANT EXECUTE ON FUNCTION public.import_bulk_lead_consumer(jsonb) TO anon')
    expect(sql053).not.toContain('GRANT EXECUTE ON FUNCTION public.bulk_lead_import_collect_candidates')
    expect(sql053).not.toContain('GRANT EXECUTE ON FUNCTION public.bulk_lead_import_classify_match')
    expect(sql053).not.toContain('GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO anon')
    for (const marker of MIGRATION_053_FORBIDDEN_MARKERS) {
      expect(sql053).not.toContain(marker)
    }
  })

  it('keeps 052 archive security and only adds Bulk Lead Import to the allowlist', () => {
    const grant = 'GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO authenticated;'
    const start052 = sql052.indexOf('CREATE OR REPLACE FUNCTION public.archive_intake_lead(')
    const start053 = sql053.indexOf('CREATE OR REPLACE FUNCTION public.archive_intake_lead(')
    const end052 = sql052.lastIndexOf(grant)
    const end053 = sql053.lastIndexOf(grant)
    expect(start052).toBeGreaterThan(0)
    expect(start053).toBeGreaterThan(0)
    expect(end052).toBeGreaterThan(start052)
    expect(end053).toBeGreaterThan(start053)
    const archive052 = sql052.slice(start052, end052 + grant.length)
    const archive053 = sql053.slice(start053, end053 + grant.length)
    const normalized053 = archive053
      .replace(",\n    'Bulk Lead Import'", '')
      .replace(' Allowlisted types include Bulk Lead Import.', '')
    expect(normalized053).toBe(archive052)
    expect(archive053).toContain("'Bulk Lead Import'")
    expect(archive052).not.toContain("'Bulk Lead Import'")

    const activityAt = archive053.indexOf('PERFORM public.crm_write_activity(')
    const leadUpdateAt = archive053.indexOf('UPDATE public.leads')
    const deletedAt = archive053.lastIndexOf('SET deleted_at = now()')
    expect(activityAt).toBeGreaterThan(0)
    expect(leadUpdateAt).toBeGreaterThan(activityAt)
    expect(deletedAt).toBeGreaterThan(activityAt)
    expect(archive053).not.toMatch(/UPDATE public\.leads[\s\S]{0,400}PERFORM public\.crm_write_activity/)
    expect(archive053).toContain('SECURITY DEFINER')
    expect(archive053).toContain('SET search_path = pg_catalog, public, extensions')
    expect(archive053).toContain('public.crm_is_owner()')
    expect(archive053).toContain('public.crm_can_access_household(v_lead.household_id)')
    expect(archive053).toContain('REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM PUBLIC')
    expect(archive053).toContain('REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM anon')
    expect(archive053).toContain('REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM authenticated')
    expect((sql053.match(/SECURITY DEFINER/g) ?? []).length).toBe(4)
    expect((sql053.match(/SET search_path = pg_catalog, public, extensions/g) ?? []).length).toBe(4)
  })

  it('does not modify Migrations 047–052', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sha256(`supabase/migrations/${MIGRATION_049_FILENAME}`)).toBe(SHA_049)
    expect(sha256(`supabase/migrations/${MIGRATION_050_FILENAME}`)).toBe(SHA_050)
    expect(sha256(`supabase/migrations/${MIGRATION_051_FILENAME}`)).toBe(SHA_051)
    expect(sha256(`supabase/migrations/${MIGRATION_052_FILENAME}`)).toBe(SHA_052)
  })
})
