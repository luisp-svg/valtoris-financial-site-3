/**
 * Live CRM-dev READ for Migration 050 Credit Report Card ingest enablement.
 * Hard-requires linked project-ref cxgiaevervjttbuiramd. Never targets CRM-prod.
 * Definition/catalog reads only. Does not create a public Credit submission.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXISTING_PUBLIC_ASSESSMENT_TYPES,
  MIGRATION_050_ASSESSMENT_TYPE,
  MIGRATION_050_COPY,
  MIGRATION_050_LEAD_SOURCE,
  MIGRATION_050_LEAD_TYPE,
} from './migration050Contract'

const REQUIRED_REF = 'cxgiaevervjttbuiramd'

function linkedRef(): string | null {
  try {
    const ref = readFileSync(resolve(process.cwd(), 'supabase/.temp/project-ref'), 'utf8').trim()
    return ref || null
  } catch {
    return null
  }
}

function crmDevReady(): boolean {
  const ref = linkedRef()
  return ref === REQUIRED_REF && !/prod|production/i.test(ref)
}

function queryLinked(sql: string): Record<string, unknown>[] {
  const dir = mkdtempSync(join(tmpdir(), 'm050-crmdev-'))
  const file = join(dir, 'query.sql')
  writeFileSync(file, sql, 'utf8')
  try {
    const stdout = execSync(`npx supabase db query --linked --file ${JSON.stringify(file)} -o json`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed = JSON.parse(stdout) as unknown
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)) {
      return (parsed as { rows: Record<string, unknown>[] }).rows
    }
    throw new Error('unexpected supabase db query JSON shape')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!crmDevReady())('migration 050 CRM-dev Credit ingest enablement (cxgiaevervjttbuiramd only)', () => {
  it('enum contains credit exactly once and keeps existing values', () => {
    const rows = queryLinked(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'assessment_type'
      ORDER BY e.enumsortorder
    `)
    const labels = rows.map((row) => String(row.enumlabel))
    expect(labels.filter((label) => label === MIGRATION_050_ASSESSMENT_TYPE)).toHaveLength(1)
    for (const existing of EXISTING_PUBLIC_ASSESSMENT_TYPES) {
      expect(labels).toContain(existing)
    }
    expect(labels).toContain('household_onboarding')
    expect(labels.filter((label) => label === 'credit_repair')).toHaveLength(0)
    expect(labels.filter((label) => label === 'credit_report_card')).toHaveLength(0)
  })

  it('assessments.assessment_type remains NOT NULL', () => {
    const rows = queryLinked(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assessments'
        AND column_name = 'assessment_type'
    `)
    expect(rows).toEqual([{ is_nullable: 'NO' }])
  })

  it('ingest, follow-up, and duplicate-review accept credit with Credit Report Card copy', () => {
    const rows = queryLinked(`
      SELECT
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS args,
        p.prosecdef AS security_definer,
        p.proconfig AS config,
        pg_get_userbyid(p.proowner) AS owner,
        pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'ingest_public_report_card',
          'create_public_family_follow_up_task',
          'resolve_public_family_duplicate_review'
        )
      ORDER BY p.proname
    `)
    const byName = Object.fromEntries(rows.map((row) => [String(row.proname), row]))
    expect(Object.keys(byName).sort()).toEqual([
      'create_public_family_follow_up_task',
      'ingest_public_report_card',
      'resolve_public_family_duplicate_review',
    ])

    const ingest = String(byName.ingest_public_report_card.def)
    expect(ingest).toContain(MIGRATION_050_ASSESSMENT_TYPE)
    expect(ingest).toContain(MIGRATION_050_LEAD_TYPE)
    expect(ingest).toContain(MIGRATION_050_LEAD_SOURCE)
    expect(ingest).toContain("WHEN 'credit' THEN 'Credit Report Card'")
    expect(ingest).toContain("WHEN 'credit' THEN 'credit_report_card'")
    expect(ingest).toContain('Family Report Card')
    expect(ingest).toContain('Student Loan Report Card')
    expect(ingest).not.toContain('INSERT INTO public.opportunities')
    expect(ingest).not.toMatch(/ingest_public_credit/)
    expect(byName.ingest_public_report_card.security_definer).toBe(true)

    const follow = String(byName.create_public_family_follow_up_task.def)
    expect(follow).toContain("'credit'")
    expect(follow).toContain("WHEN 'credit' THEN 'Credit Report Card'")
    expect(follow).toContain("v_title := 'Review ' || v_product || ' and follow up'")
    expect(follow).toContain("'Follow-up review task created for public ' || v_product || '.'")
    expect(follow).toContain(MIGRATION_050_COPY.workflowType)
    expect(follow).toContain("IF v_assessment.assessment_type = 'family' THEN")
    expect(byName.create_public_family_follow_up_task.args).toBe(
      'p_assessment_id uuid, p_workflow_type text, p_creation_source text',
    )
    expect(byName.create_public_family_follow_up_task.security_definer).toBe(true)
    expect(byName.create_public_family_follow_up_task.owner).toBe('postgres')

    const dup = String(byName.resolve_public_family_duplicate_review.def)
    expect(dup).toContain("'credit'")
    expect(dup).toContain(MIGRATION_050_LEAD_TYPE)
    expect(dup).not.toContain('INSERT INTO public.opportunities')
  }, 60_000)

  it('preserves grants and adds no new function, table, or column', () => {
    const extra = queryLinked(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (
          p.proname LIKE 'ingest_public_credit%'
          OR p.proname LIKE 'create_public_credit%'
          OR p.proname LIKE 'resolve_public_credit%'
        )
    `)
    expect(extra).toEqual([])

    const ingestGrants = queryLinked(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'ingest_public_report_card'
      ORDER BY grantee, privilege_type
    `)
    const ingestPairs = ingestGrants.map((row) => `${row.grantee}:${row.privilege_type}`).sort()
    expect(ingestPairs).toContain('service_role:EXECUTE')
    expect(ingestPairs.some((pair) => pair.startsWith('anon:'))).toBe(false)
    expect(ingestPairs.some((pair) => pair.startsWith('authenticated:'))).toBe(false)

    const followGrants = queryLinked(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'create_public_family_follow_up_task'
      ORDER BY grantee, privilege_type
    `)
    const followPairs = followGrants.map((row) => `${row.grantee}:${row.privilege_type}`).sort()
    expect(followPairs).toContain('authenticated:EXECUTE')
    expect(followPairs).toContain('service_role:EXECUTE')
    expect(followPairs.some((pair) => pair.startsWith('anon:'))).toBe(false)

    const schema = queryLinked(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name LIKE 'credit_report%') AS new_tables,
        (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND column_name LIKE 'credit_report%') AS new_columns
    `)
    expect(Number(schema[0].new_tables)).toBe(0)
    expect(Number(schema[0].new_columns)).toBe(0)
  }, 60_000)
})
