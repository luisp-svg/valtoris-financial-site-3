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
import { MIGRATION_051_FILENAME } from './migration051Contract'
import { MIGRATION_052_FILENAME } from './migration052Contract'
import { MIGRATION_053_FILENAME } from './migration053Contract'
import { MIGRATION_054_FILENAME } from './migration054Contract'
import {
  MIGRATION_055_COLUMNS,
  MIGRATION_055_CONTRACT_MARKERS,
  MIGRATION_055_FILENAME,
  MIGRATION_055_FORBIDDEN_COLUMNS,
  MIGRATION_055_FORBIDDEN_MARKERS,
  MIGRATION_055_TABLE,
} from './migration055Contract'

const SHA_054 = 'da65bd0355e842d1a108b4985742a18514dfd2df1f6c9157cdb461229e24dd1b'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql055 = readFileSync(resolve(migrationsDir, MIGRATION_055_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

function createTableBody(sql: string): string {
  const match = sql.match(
    /CREATE TABLE IF NOT EXISTS public\.integration_contact_links \(([\s\S]*?)\n\);/,
  )
  return match?.[1] ?? ''
}

describe('migration 055 integration contact links', () => {
  it('is the only 055 file, follows 054, preserves 001–055 and permits insurance 056, and permits the approved insurance 056', () => {
    expect(MIGRATION_055_FILENAME).toBe('055_integration_contact_links.sql')
    expect(MIGRATION_055_TABLE).toBe('integration_contact_links')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(65)
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
    expect(files[53]).toBe(MIGRATION_054_FILENAME)
    expect(files[54]).toBe(MIGRATION_055_FILENAME)
    expect(files.filter((f) => f.startsWith('054_'))).toEqual([MIGRATION_054_FILENAME])
    expect(files.filter((f) => f.startsWith('055_'))).toEqual([MIGRATION_055_FILENAME])
    expect(files.filter((f) => f.startsWith('056_'))).toEqual(['056_insurance_quote_intake.sql'])
    expect(files.filter((f) => f.startsWith('057_'))).toEqual(['057_insurance_quote_delivery.sql'])
  })

  it('defines only the durable identity columns, both unique keys, and a member foreign key', () => {
    for (const marker of MIGRATION_055_CONTRACT_MARKERS) {
      expect(sql055).toContain(marker)
    }
    const body = createTableBody(sql055)
    expect(body.length).toBeGreaterThan(0)
    for (const column of MIGRATION_055_COLUMNS) {
      expect(body).toContain(column)
    }
    expect(body).toContain('REFERENCES public.household_members (id) ON DELETE RESTRICT')
    expect(body).not.toContain('ON DELETE CASCADE')
    expect(sql055).toContain('UNIQUE (provider, location_id, external_contact_id)')
    expect(sql055).toContain('UNIQUE (provider, location_id, household_member_id)')
  })

  it('stores no contact PII, credentials, or sync-attempt fields', () => {
    const body = createTableBody(sql055)
    for (const column of MIGRATION_055_FORBIDDEN_COLUMNS) {
      expect(body).not.toMatch(new RegExp(`\\b${column}\\b`))
    }
  })

  it('keeps provider as free text and does not make one provider the only allowed value', () => {
    expect(sql055).toContain('provider text NOT NULL')
    expect(sql055).not.toContain('CREATE TYPE')
    expect(sql055).not.toContain('AS ENUM')
    expect(sql055).not.toMatch(/provider\s+IN\s*\(/)
    expect(sql055).not.toMatch(/provider\s*=\s*'/)
    for (const marker of MIGRATION_055_FORBIDDEN_MARKERS) {
      expect(sql055).not.toContain(marker)
    }
  })

  it('enables forced RLS, allows authenticated read through household access, and grants no client writes', () => {
    expect(sql055).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql055).toContain('FORCE ROW LEVEL SECURITY')
    expect(sql055).toContain('FOR SELECT TO authenticated')
    expect(sql055).toContain('public.crm_can_access_household(m.household_id)')
    expect(sql055).not.toMatch(/CREATE POLICY[\s\S]*FOR INSERT/)
    expect(sql055).not.toMatch(/CREATE POLICY[\s\S]*FOR UPDATE/)
    expect(sql055).not.toMatch(/CREATE POLICY[\s\S]*FOR DELETE/)
    expect(sql055).not.toContain('FOR ALL')
    expect(sql055).toContain('GRANT SELECT ON TABLE public.integration_contact_links TO authenticated')
    expect(sql055).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.integration_contact_links FROM authenticated',
    )
    expect(sql055).not.toContain('TO anon')
    expect(sql055).not.toContain('GRANT INSERT')
    expect(sql055).not.toContain('GRANT UPDATE')
    expect(sql055).not.toContain('GRANT DELETE')
    expect(sql055).toContain('GRANT ALL ON TABLE public.integration_contact_links TO service_role')
  })

  it('does not modify Migration 054', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_054_FILENAME}`)).toBe(SHA_054)
  })
})
