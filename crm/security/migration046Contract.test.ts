import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import {
  MIGRATION_046_CONTRACT_MARKERS,
  MIGRATION_046_FILENAME,
  MIGRATION_046_FORBIDDEN_MARKERS,
  MIGRATION_046_RPC,
} from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_046_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

describe('migration 046 opportunity case conversion contract', () => {
  it('is the only 046 file, follows 045, and is followed by 047 sales catalog', () => {
    expect(MIGRATION_046_FILENAME).toBe('046_opportunity_case_conversion.sql')
    expect(MIGRATION_046_RPC).toBe('convert_opportunity_to_policy_application')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(49)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(files.filter((f) => f.startsWith('045_'))).toEqual([MIGRATION_045_FILENAME])
    expect(files.filter((f) => f.startsWith('046_'))).toEqual([MIGRATION_046_FILENAME])
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((f) => f.startsWith('050_'))).toEqual([])
  })

  it('adds the live opportunity unique index and the conversion RPC with audit and grants', () => {
    for (const marker of MIGRATION_046_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('does not add a second linkage column, commissions, historical import, or 047', () => {
    for (const marker of MIGRATION_046_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.create_policy_application')
    expect(sql).not.toContain('transition_policy_application_stage')
  })

  it('keeps conversion on existing opportunity_id and create_policy_application', () => {
    expect(sql).toContain('opportunity_id')
    expect(sql).toContain('create_policy_application')
    expect(sql).not.toContain('source_opportunity_id')
    expect(sql).toContain('v_household_id := v_opp.household_id')
  })
})
