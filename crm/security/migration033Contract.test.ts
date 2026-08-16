import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_032_FILENAME } from './migration032Contract'
import {
  MIGRATION_033_CONTRACT_MARKERS,
  MIGRATION_033_FILENAME,
  MIGRATION_033_FORBIDDEN_MARKERS,
} from './migration033Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_033_FILENAME), 'utf8')

describe('migration 033 writing-advisor compensation foundation contract', () => {
  it('records the approved filename after 032', () => {
    expect(MIGRATION_033_FILENAME).toBe('033_writing_advisor_compensation_foundation.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_032_FILENAME)
    expect(files).toContain(MIGRATION_033_FILENAME)
    expect(files.indexOf(MIGRATION_033_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_032_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('033_'))).toEqual([MIGRATION_033_FILENAME])
  })

  it('includes required schema, RPC, RLS, and comment markers', () => {
    for (const marker of MIGRATION_033_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids 034, enums, gist exclusions, ledger tables, upline, and legacy-table logic', () => {
    for (const marker of MIGRATION_033_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('uses TEXT contract levels rather than a PostgreSQL enum', () => {
    expect(sql).toContain("contract_level IN ('FA', 'SFA', 'SM', 'ED')")
    expect(sql).toContain("writing_contract_level IN ('FA', 'SFA', 'SM', 'ED')")
    expect(sql).not.toMatch(/CREATE TYPE public\.advisor_contract_level/)
  })

  it('keeps rate-card SELECT owner-only and grants RPCs to authenticated', () => {
    expect(sql).toContain('AND public.crm_is_owner()')
    expect(sql).toContain('GRANT SELECT ON TABLE public.product_compensation_schedules TO authenticated')
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_compensation_schedules',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.set_advisor_contract_level(uuid, text) TO authenticated',
    )
  })

  it('documents separate effective-date and issue-age rules', () => {
    expect(sql).toContain('submission_date')
    expect(sql).toContain('issue_date')
    expect(sql).toContain('review_required')
    expect(sql).toMatch(/Do NOT use created_at for money/)
    expect(sql).toMatch(/Issue age is a SEPARATE input/i)
  })
})
