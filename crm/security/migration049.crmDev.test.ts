/**
 * Live CRM-dev READ for Migration 049 follow-up copy specialization.
 * Hard-requires linked project-ref cxgiaevervjttbuiramd. Never targets CRM-prod.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_049_COPY, MIGRATION_049_FUNCTION } from './migration049Contract'

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
  const dir = mkdtempSync(join(tmpdir(), 'm049-crmdev-'))
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

describe.skipIf(!crmDevReady())('migration 049 CRM-dev follow-up copy (cxgiaevervjttbuiramd only)', () => {
  it('replaces the existing function with specialized copy and unchanged privileges', () => {
    const fnRows = queryLinked(`
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
        AND p.proname = '${MIGRATION_049_FUNCTION}'
    `)
    expect(fnRows).toHaveLength(1)
    const def = String(fnRows[0].def)
    expect(fnRows[0].args).toBe('p_assessment_id uuid, p_workflow_type text, p_creation_source text')
    expect(fnRows[0].security_definer).toBe(true)
    expect(fnRows[0].owner).toBe('postgres')
    expect(JSON.stringify(fnRows[0].config)).toContain('pg_catalog')
    expect(def).toContain(MIGRATION_049_COPY.familyTitle)
    expect(def).toContain(MIGRATION_049_COPY.familyActivity)
    expect(def).toContain(MIGRATION_049_COPY.business)
    expect(def).toContain(MIGRATION_049_COPY.retirement)
    expect(def).toContain(MIGRATION_049_COPY.protection)
    expect(def).toContain(MIGRATION_049_COPY.studentLoan)
    expect(def).toContain(MIGRATION_049_COPY.workflowType)
    expect(def).toContain("WHEN 'student_loan' THEN 'Student Loan Report Card'")
    expect(def).toContain("'Follow-up review task created for public ' || v_product || '.'")
    expect(def).not.toContain('INSERT INTO public.opportunities')
    expect(def).not.toContain('v_assessment.answers')

    const extra = queryLinked(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname LIKE 'create_public_family_follow_up_task%'
    `)
    expect(extra).toHaveLength(1)

    const grants = queryLinked(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = '${MIGRATION_049_FUNCTION}'
      ORDER BY grantee, privilege_type
    `)
    const grantPairs = grants.map((row) => `${row.grantee}:${row.privilege_type}`).sort()
    expect(grantPairs).toContain('authenticated:EXECUTE')
    expect(grantPairs).toContain('service_role:EXECUTE')
    expect(grantPairs.some((pair) => pair.startsWith('anon:'))).toBe(false)

    const schema = queryLinked(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '049_unused') AS new_tables,
        (SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname LIKE 'follow_up_copy%') AS new_types
    `)
    expect(schema[0].new_tables).toBe(0)
    expect(schema[0].new_types).toBe(0)
  }, 60_000)
})
