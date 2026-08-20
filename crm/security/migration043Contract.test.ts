import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_042_FILENAME } from './migration042Contract'
import {
  MIGRATION_043_CONTRACT_MARKERS,
  MIGRATION_043_FILENAME,
  MIGRATION_043_FORBIDDEN_MARKERS,
} from './migration043Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_043_FILENAME), 'utf8')
const sql042 = readFileSync(resolve(migrationsDir, MIGRATION_042_FILENAME), 'utf8')

describe('migration 043 public Report Card ingest contract', () => {
  it('records the approved filename after 042 and does not mention 044 inside 043 SQL', () => {
    expect(MIGRATION_043_FILENAME).toBe('043_public_report_card_ingest.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_042_FILENAME)
    expect(files).toContain(MIGRATION_043_FILENAME)
    expect(files.indexOf(MIGRATION_043_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_042_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('043_'))).toEqual([MIGRATION_043_FILENAME])
    expect(files.filter((f) => f.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
  })

  it('includes the generalized ingest RPC, Family wrapper, and service_role-only grant', () => {
    for (const marker of MIGRATION_043_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('does not create tables, extra ingest endpoints, or grant ingest to anon', () => {
    for (const marker of MIGRATION_043_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.ingest_public_report_card\(jsonb\) TO anon/)
    expect(sql042).not.toContain('ingest_public_report_card')
  })

  it('keeps migrations 001–042 in place and adds only 043 as the next file', () => {
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    const through042 = files.filter((f) => {
      const n = Number(f.slice(0, 3))
      return n >= 1 && n <= 42
    })
    expect(through042).toHaveLength(42)
    expect(files.filter((f) => f.startsWith('042_'))).toEqual([MIGRATION_042_FILENAME])
    expect(files.filter((f) => f.startsWith('043_'))).toEqual([MIGRATION_043_FILENAME])
  })
})
