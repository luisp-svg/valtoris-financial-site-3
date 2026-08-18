import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_038_FILENAME } from './migration038Contract'
import {
  MIGRATION_039_CONTRACT_MARKERS,
  MIGRATION_039_FILENAME,
  MIGRATION_039_FORBIDDEN_MARKERS,
} from './migration039Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_039_FILENAME), 'utf8')

describe('migration 039 commission import review/post hardening contract', () => {
  it('records the approved filename after 038', () => {
    expect(MIGRATION_039_FILENAME).toBe('039_commission_import_review_post_hardening.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_038_FILENAME)
    expect(files).toContain(MIGRATION_039_FILENAME)
    expect(files.indexOf(MIGRATION_039_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_038_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('039_'))).toEqual([MIGRATION_039_FILENAME])
    expect(files.filter((f) => f.startsWith('040_'))).toEqual([])
  })

  it('includes required review/post hardening markers', () => {
    for (const marker of MIGRATION_039_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids schema changes, a next migration, and grant widening', () => {
    for (const marker of MIGRATION_039_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('hardens only the two 036 review/post RPCs', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.review_commission_import_row(')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.post_commission_import_row(')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.create_commission_import_batch')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.stage_commission_import_rows')
    expect(sql).not.toContain('CREATE TABLE')
    expect(sql).not.toContain('ALTER TABLE')
    expect(sql).toContain('SET search_path = pg_catalog, public, extensions')
    expect(sql).toContain('pp_assert_owner')
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/)
  })
})
