import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_034_FILENAME } from './migration034Contract'
import { MIGRATION_035_FILENAME } from './migration035Contract'
import { MIGRATION_036_FILENAME } from './migration036Contract'
import { MIGRATION_040_FILENAME } from './migration040Contract'
import {
  MIGRATION_041_CONTRACT_MARKERS,
  MIGRATION_041_FILENAME,
  MIGRATION_041_FORBIDDEN_MARKERS,
} from './migration041Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_041_FILENAME), 'utf8')
const sql040 = readFileSync(resolve(migrationsDir, MIGRATION_040_FILENAME), 'utf8')
const sql034 = readFileSync(resolve(migrationsDir, MIGRATION_034_FILENAME), 'utf8')
const sql035 = readFileSync(resolve(migrationsDir, MIGRATION_035_FILENAME), 'utf8')
const sql036 = readFileSync(resolve(migrationsDir, MIGRATION_036_FILENAME), 'utf8')

describe('migration 041 commission pending review contract', () => {
  it('records the approved filename after 040', () => {
    expect(MIGRATION_041_FILENAME).toBe('041_commission_pending_review.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_040_FILENAME)
    expect(files).toContain(MIGRATION_041_FILENAME)
    expect(files.indexOf(MIGRATION_041_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_040_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('041_'))).toEqual([MIGRATION_041_FILENAME])
    expect(files.filter((f) => f.startsWith('042_'))).toEqual([])
  })

  it('includes required review RPC, immutability context, and grant markers', () => {
    for (const marker of MIGRATION_041_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids schema changes, 035 writes, paid RPC reuse, and the next migration', () => {
    for (const marker of MIGRATION_041_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('does not edit 040 SQL and does not change 034/035/036 paid identity', () => {
    expect(sql040).not.toContain('041_')
    expect(sql040).not.toContain('review_commission_pending_import_row')
    expect(sql034).not.toContain('review_commission_pending_import_row')
    expect(sql035).not.toContain("event_type IN ('pending'")
    expect(sql035).toContain(
      "event_type IN ('paid', 'adjustment', 'chargeback', 'recovery', 'reversal')",
    )
    expect(sql036).toContain("source_type IN ('experior_paid_report')")
    expect(sql036).not.toContain('experior_pending_report')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event')
  })

  it('keeps owner-only execute and does not grant anon', () => {
    expect(sql).toContain('pp_assert_owner()')
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.review_commission_pending_import_row(',
    )
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/)
    expect(sql).not.toMatch(/GRANT INSERT|GRANT UPDATE|GRANT DELETE/)
  })
})
