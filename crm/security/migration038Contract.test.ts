import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_037_FILENAME } from './migration037Contract'
import {
  MIGRATION_038_CONTRACT_MARKERS,
  MIGRATION_038_FILENAME,
  MIGRATION_038_FORBIDDEN_MARKERS,
} from './migration038Contract'
import { MIGRATION_039_FILENAME } from './migration039Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_038_FILENAME), 'utf8')

describe('migration 038 historical import support contract', () => {
  it('records the approved filename after 037', () => {
    expect(MIGRATION_038_FILENAME).toBe('038_historical_import_support.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_037_FILENAME)
    expect(files).toContain(MIGRATION_038_FILENAME)
    expect(files.indexOf(MIGRATION_038_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_037_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('038_'))).toEqual([MIGRATION_038_FILENAME])
    expect(files.filter((f) => f.startsWith('039_'))).toEqual([MIGRATION_039_FILENAME])
    expect(files.indexOf(MIGRATION_039_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_038_FILENAME),
    )
  })

  it('includes required owner-only historical import markers', () => {
    for (const marker of MIGRATION_038_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids a second client/policy system, 039, and compensation changes', () => {
    for (const marker of MIGRATION_038_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('keeps the existing household/member architecture and optional contact', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_canonical_client(p_payload jsonb)')
    expect(sql).toContain("INSERT INTO public.households (")
    expect(sql).toContain("INSERT INTO public.household_members (")
    expect(sql).toContain('date_of_birth')
    expect(sql).toContain('household_members.date_of_birth')
    expect(sql).not.toContain('ALTER TABLE public.household_members ADD')
    expect(sql).not.toContain('CREATE TABLE public.household_members')
    expect(sql).toContain('Email and phone are optional')
    expect(sql).toContain('Do not invent placeholder contact information')
  })

  it('scopes inactive catalog and historical dates to the owner historical path', () => {
    expect(sql).toContain('historical_entry')
    expect(sql).toContain('p_allow_inactive')
    expect(sql).toContain('New-business catalog must be active')
    expect(sql).toContain('AND NOT v_historical')
    expect(sql).toContain('unknown historical dates NULL instead of CURRENT_DATE')
    expect(sql).toContain('premium_drafted cannot skip issued')
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.transition_policy_application_stage(\n  uuid, text, text, text, text, jsonb\n)',
    )
  })

  it('does not weaken RLS, expose anon, or change 034/035/036 writers', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.create_canonical_client(jsonb) FROM PUBLIC, anon')
    expect(sql).toContain('SET search_path = pg_catalog, public, extensions')
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/)
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.quick_add_contact(')
    expect(sql).not.toContain(
      'CREATE OR REPLACE FUNCTION public.pp_refresh_application_expected_compensation',
    )
    expect(sql).not.toContain(
      'CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event',
    )
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.create_commission_import_batch')
  })
})
