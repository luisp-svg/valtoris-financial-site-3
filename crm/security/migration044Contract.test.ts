import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_043_FILENAME } from './migration043Contract'
import {
  MIGRATION_044_APPROVED_RPCS,
  MIGRATION_044_CONTRACT_MARKERS,
  MIGRATION_044_FILENAME,
  MIGRATION_044_FORBIDDEN_MARKERS,
} from './migration044Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_044_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

describe('migration 044 policy application requirements contract', () => {
  it('records the approved filename after 043 and is followed by 045, 046, then 047', () => {
    expect(MIGRATION_044_FILENAME).toBe('044_policy_application_requirements.sql')
    const files = numberedMigrations()
    expect(files).toContain(MIGRATION_043_FILENAME)
    expect(files).toContain(MIGRATION_044_FILENAME)
    expect(files.indexOf(MIGRATION_044_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_043_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('043_'))).toEqual([MIGRATION_043_FILENAME])
    expect(files.filter((f) => f.startsWith('044_'))).toEqual([MIGRATION_044_FILENAME])
    expect(files.filter((f) => f.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((f) => f.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual([])
    expect(files.filter((f) => Number(f.slice(0, 3)) >= 1 && Number(f.slice(0, 3)) <= 43)).toHaveLength(
      43,
    )
  })

  it('includes the requirement table, history, codes, statuses, RLS, and RPCs', () => {
    for (const marker of MIGRATION_044_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('does not create public.cases, policy_requirements, sibling FKs, notes, metadata, or 045', () => {
    for (const marker of MIGRATION_044_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toMatch(/CREATE TABLE(?: IF NOT EXISTS)? public\.cases\b/)
    expect(sql).not.toMatch(/CREATE TABLE(?: IF NOT EXISTS)? public\.policy_requirements\b/)
  })

  it('does not add application_id to tasks, documents, notes, or activities', () => {
    expect(sql).not.toMatch(/ALTER TABLE public\.(tasks|documents|notes|activities)\b/)
    expect(sql).not.toMatch(/\b(tasks|documents|notes|activities)\.application_id\b/)
    for (const file of numberedMigrations()) {
      const body = readFileSync(resolve(migrationsDir, file), 'utf8')
      expect(body, file).not.toMatch(
        /ALTER TABLE public\.(tasks|documents|notes|activities)\s+ADD(?:\s+COLUMN)?\s+application_id/,
      )
    }
  })

  it('has no notes or metadata columns on the requirement tables', () => {
    expect(sql).not.toMatch(/^\s*notes\s/m)
    expect(sql).not.toMatch(/\bnotes text\b/)
    expect(sql).not.toMatch(/\bmetadata\b/)
  })

  it('does not backfill requirements or rewrite applications, commissions, or stages', () => {
    expect(sql).toContain('This migration creates ZERO requirement rows')
    expect(sql).toContain('performs ZERO backfill')
    expect(sql).not.toMatch(/INSERT INTO public\.policy_application_requirements\s+SELECT/)
    expect(sql).not.toMatch(/INSERT INTO public\.policy_application_requirement_history\s+SELECT/)
    expect(sql).not.toContain('UPDATE public.policy_applications')
    expect(sql).not.toContain('transition_policy_application_stage')
    expect(sql).not.toContain('record_policy_writing_commission_event')
    expect(sql).not.toContain('pp_refresh_application_expected_compensation')
    expect(sql).not.toContain('writing_receivable_expected')
  })

  it('enables and forces RLS and blocks authenticated direct DML', () => {
    expect(sql).toContain(
      'ALTER TABLE public.policy_application_requirements ENABLE ROW LEVEL SECURITY',
    )
    expect(sql).toContain(
      'ALTER TABLE public.policy_application_requirements FORCE ROW LEVEL SECURITY',
    )
    expect(sql).toContain(
      'ALTER TABLE public.policy_application_requirement_history ENABLE ROW LEVEL SECURITY',
    )
    expect(sql).toContain(
      'ALTER TABLE public.policy_application_requirement_history FORCE ROW LEVEL SECURITY',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_requirements FROM authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_requirement_history FROM authenticated',
    )
  })

  it('exposes only the approved authenticated mutation RPCs', () => {
    for (const name of MIGRATION_044_APPROVED_RPCS) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${name}`)
    }
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_policy_application_requirement')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.update_policy_application_requirement')
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.transition_policy_application_requirement_status',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.soft_delete_policy_application_requirement',
    )
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.(?!create_policy_application_requirement|update_policy_application_requirement|transition_policy_application_requirement_status|soft_delete_policy_application_requirement)/,
    )
  })
})
