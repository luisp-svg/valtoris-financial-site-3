import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_033_FILENAME } from './migration033Contract'
import {
  MIGRATION_034_CONTRACT_MARKERS,
  MIGRATION_034_FILENAME,
  MIGRATION_034_FORBIDDEN_MARKERS,
} from './migration034Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_034_FILENAME), 'utf8')

describe('migration 034 writing-advisor expected compensation contract', () => {
  it('records the approved filename after 033', () => {
    expect(MIGRATION_034_FILENAME).toBe('034_writing_advisor_expected_compensation.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_033_FILENAME)
    expect(files).toContain(MIGRATION_034_FILENAME)
    expect(files.indexOf(MIGRATION_034_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_033_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('034_'))).toEqual([MIGRATION_034_FILENAME])
  })

  it('includes required schema, RPC, RLS, and comment markers', () => {
    for (const marker of MIGRATION_034_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids ledger tables, upline, enums, and the next migration', () => {
    for (const marker of MIGRATION_034_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('uses TEXT calculation_status rather than a PostgreSQL enum', () => {
    expect(sql).toContain("calculation_status IN ('resolved', 'review_required', 'unavailable')")
    expect(sql).not.toMatch(/CREATE TYPE public\.expected_compensation_status/)
  })

  it('keeps expected-compensation DML revoked and owner recalc granted to authenticated', () => {
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.policy_application_expected_compensations TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_expected_compensations',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.recalculate_policy_application_expected_compensation(uuid, text) TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.pp_refresh_application_expected_compensation(uuid, text)',
    )
  })

  it('documents lookup-date, fail-closed, writing-rank, and age-sensitive rules', () => {
    expect(sql).toContain('submission_date')
    expect(sql).toContain('issue_date')
    expect(sql).toMatch(/Do NOT use created_at for money/)
    expect(sql).toContain('writing_contract_level')
    expect(sql).toContain('advisor_profiles.contract_level')
    expect(sql).toContain('House and servicing')
    expect(sql).toContain('age_sensitive_rate_card')
    expect(sql).toContain('Administrative eligibility cap')
    expect(sql).toContain('True age-dependent schedule')
    expect(sql).toContain('crm_write_audit')
    expect(sql).not.toMatch(/crm_can_access_household\(a\.household_id\)/)
  })
})
