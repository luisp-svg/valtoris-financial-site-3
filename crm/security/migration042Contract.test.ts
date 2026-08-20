import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_034_FILENAME } from './migration034Contract'
import { MIGRATION_035_FILENAME } from './migration035Contract'
import { MIGRATION_038_FILENAME } from './migration038Contract'
import { MIGRATION_041_FILENAME } from './migration041Contract'
import {
  MIGRATION_042_CONTRACT_MARKERS,
  MIGRATION_042_FILENAME,
  MIGRATION_042_FORBIDDEN_MARKERS,
} from './migration042Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_042_FILENAME), 'utf8')
const sql034 = readFileSync(resolve(migrationsDir, MIGRATION_034_FILENAME), 'utf8')
const sql035 = readFileSync(resolve(migrationsDir, MIGRATION_035_FILENAME), 'utf8')
const sql038 = readFileSync(resolve(migrationsDir, MIGRATION_038_FILENAME), 'utf8')
const sql041 = readFileSync(resolve(migrationsDir, MIGRATION_041_FILENAME), 'utf8')

describe('migration 042 writing-receivable eligibility contract', () => {
  it('records the approved filename after 041 and allows 043', () => {
    expect(MIGRATION_042_FILENAME).toBe('042_writing_receivable_eligibility.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_041_FILENAME)
    expect(files).toContain(MIGRATION_042_FILENAME)
    expect(files.indexOf(MIGRATION_042_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_041_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('042_'))).toEqual([MIGRATION_042_FILENAME])
    expect(files.filter((f) => f.startsWith('043_'))).toEqual([
      '043_public_report_card_ingest.sql',
    ])
  })

  it('includes the durable column, owner RPC, 034 honor path, and audit markers', () => {
    for (const marker of MIGRATION_042_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('does not infer eligibility from historical_entry, dates, or 035/Pending writers', () => {
    for (const marker of MIGRATION_042_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).toContain('historical_entry does NOT set this')
    expect(sql).not.toContain('v_historical IS TRUE THEN')
    expect(sql038).not.toContain('writing_receivable_expected')
    expect(sql034).not.toContain('writing_receivable_expected')
    expect(sql041).not.toContain('set_policy_application_writing_receivable_expected')
  })

  it('keeps 035 paid identity and does not grant anon or table DML', () => {
    expect(sql035).toContain(
      "event_type IN ('paid', 'adjustment', 'chargeback', 'recovery', 'reversal')",
    )
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event')
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/)
    expect(sql).toContain('pp_assert_owner()')
  })
})
