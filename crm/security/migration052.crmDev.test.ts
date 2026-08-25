/**
 * Live CRM-dev READ for Migration 052 archive_intake_lead Activity ordering.
 * Hard-requires linked project-ref cxgiaevervjttbuiramd. Never targets CRM-prod.
 * Definition/history/grant reads only. Does not archive any lead.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_051_RPC } from './migration051Contract'
import { MIGRATION_052_RPC } from './migration052Contract'

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
  const dir = mkdtempSync(join(tmpdir(), 'm052-crmdev-'))
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

describe.skipIf(!crmDevReady())('migration 052 CRM-dev archive Activity order (cxgiaevervjttbuiramd only)', () => {
  it('records 052 in remote history and keeps one archive_intake_lead signature', () => {
    const versions = queryLinked(`
      SELECT version
      FROM supabase_migrations.schema_migrations
      WHERE version IN ('050', '051', '052', '053')
      ORDER BY version
    `)
    const labels = versions.map((row) => String(row.version))
    expect(labels).toEqual(['050', '051', '052'])

    const fns = queryLinked(`
      SELECT
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS args,
        p.prosecdef AS security_definer,
        p.proconfig AS config,
        pg_get_userbyid(p.proowner) AS owner
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = '${MIGRATION_052_RPC}'
    `)
    expect(MIGRATION_052_RPC).toBe(MIGRATION_051_RPC)
    expect(fns).toHaveLength(1)
    expect(fns[0].args).toBe('p_lead_id uuid, p_reason text')
    expect(fns[0].security_definer).toBe(true)
    expect(fns[0].owner).toBe('postgres')
    const config = String(fns[0].config ?? '')
    expect(config).toContain('pg_catalog')
    expect(config).toContain('public')
    expect(config).toContain('extensions')
  }, 60_000)

  it('keeps Activity before leads.deleted_at in the live body and preserves grants', () => {
    const grants = queryLinked(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = '${MIGRATION_052_RPC}'
      ORDER BY grantee, privilege_type
    `)
    const pairs = grants.map((row) => `${row.grantee}:${row.privilege_type}`).sort()
    expect(pairs).toContain('authenticated:EXECUTE')
    expect(pairs.some((pair) => pair.startsWith('anon:'))).toBe(false)

    const defRows = queryLinked(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = '${MIGRATION_052_RPC}'
    `)
    const def = String(defRows[0]?.def ?? '')
    const activityAt = def.indexOf('PERFORM public.crm_write_activity(')
    const leadUpdateAt = def.indexOf('UPDATE public.leads')
    expect(activityAt).toBeGreaterThan(0)
    expect(leadUpdateAt).toBeGreaterThan(activityAt)
    expect(def).toContain('v_lead.id')
    expect(def).toContain('CRM_INTAKE:duplicate_review_pending')
    expect(def).toContain('CRM_INTAKE:already_archived')
    expect(def).not.toContain('crm_advisors_can_view_unassigned')
    expect(def).not.toContain('DELETE FROM')
    expect(def).not.toContain('INSERT INTO public.opportunities')
  }, 60_000)

  it('adds no new table or column and does not grant Activity INSERT to authenticated', () => {
    const schema = queryLinked(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name LIKE 'intake_archive%') AS new_tables,
        (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND column_name LIKE 'archive_reason%') AS new_columns
    `)
    expect(Number(schema[0].new_tables)).toBe(0)
    expect(Number(schema[0].new_columns)).toBe(0)

    const activityInserts = queryLinked(`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'activities'
        AND privilege_type = 'INSERT'
      ORDER BY grantee
    `)
    const insertGrantees = activityInserts.map((row) => String(row.grantee))
    expect(insertGrantees).not.toContain('authenticated')
    expect(insertGrantees).not.toContain('anon')
  }, 60_000)
})
