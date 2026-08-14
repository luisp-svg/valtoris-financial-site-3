import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_030_CONTRACT_MARKERS,
  MIGRATION_030_FILENAME,
  MIGRATION_030_FINAL_ACTIVITY_GRANTS,
  MIGRATION_030_FORBIDDEN_MARKERS,
} from './migration030Contract'
import { MIGRATION_029_FILENAME } from './migration029Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_030_FILENAME), 'utf8')

describe('migration 030 Activity INSERT revoke contract', () => {
  it('records the approved migration filename and order after 029', () => {
    expect(MIGRATION_030_FILENAME).toBe(
      '030_revoke_authenticated_activity_inserts.sql',
    )
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_029_FILENAME)
    expect(files).toContain(MIGRATION_030_FILENAME)
    expect(files.indexOf(MIGRATION_030_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_029_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('030_'))).toEqual([
      MIGRATION_030_FILENAME,
    ])
    // Later migrations 031/032 may exist after their authorized phases.
  })

  it('includes all required grant/policy markers', () => {
    for (const marker of MIGRATION_030_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids Task Completion, Quick Add RPCs, Migration 032, and re-granting authenticated writes', () => {
    for (const marker of MIGRATION_030_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('documents deterministic final privilege surface', () => {
    expect([...MIGRATION_030_FINAL_ACTIVITY_GRANTS.authenticated]).toEqual([
      'SELECT',
    ])
    expect(MIGRATION_030_FINAL_ACTIVITY_GRANTS.service_role).toBe('ALL')
    expect(MIGRATION_030_FINAL_ACTIVITY_GRANTS.anon).toEqual([])
    expect(MIGRATION_030_FINAL_ACTIVITY_GRANTS.public).toEqual([])
  })

  it('drops obsolete activities_insert and keeps SELECT policy intact', () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS activities_insert ON public.activities',
    )
    expect(sql).toContain('activities_select remains')
    expect(sql).not.toMatch(
      /CREATE\s+POLICY\s+activities_insert\s+ON\s+public\.activities/i,
    )
  })

  it('reasserts record_crm_activity EXECUTE for authenticated only', () => {
    const revokeIdx = sql.indexOf(
      'REVOKE ALL ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)',
    )
    const grantIdx = sql.indexOf(
      'GRANT EXECUTE ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)',
    )
    expect(revokeIdx).toBeGreaterThan(-1)
    expect(grantIdx).toBeGreaterThan(revokeIdx)
    expect(sql).toContain('TO authenticated')
  })

  it('applies authenticated SELECT after full revoke (deterministic rewrite)', () => {
    const revokeAuth = sql.indexOf(
      'REVOKE ALL ON TABLE public.activities FROM authenticated',
    )
    const grantSelect = sql.indexOf(
      'GRANT SELECT ON TABLE public.activities TO authenticated',
    )
    expect(revokeAuth).toBeGreaterThan(-1)
    expect(grantSelect).toBeGreaterThan(revokeAuth)
  })
})
