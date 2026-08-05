import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_031_CONTRACT_MARKERS,
  MIGRATION_031_FILENAME,
  MIGRATION_031_FORBIDDEN_MARKERS,
} from './migration031Contract'
import { MIGRATION_030_FILENAME } from './migration030Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_031_FILENAME), 'utf8')

describe('migration 031 Quick Add Contact foundation contract', () => {
  it('records the approved migration filename after 030 and forbids 032', () => {
    expect(MIGRATION_031_FILENAME).toBe('031_quick_add_contact_foundation.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_030_FILENAME)
    expect(files).toContain(MIGRATION_031_FILENAME)
    expect(files.indexOf(MIGRATION_031_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_030_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('031_'))).toEqual([MIGRATION_031_FILENAME])
    expect(files.some((f) => f.startsWith('032_'))).toBe(false)
  })

  it('includes required schema, token, trigger, RPC, and grant markers', () => {
    for (const marker of MIGRATION_031_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids Migration 032, Activity expansion, contacts table, and client exclude_household_id', () => {
    for (const marker of MIGRATION_031_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toMatch(
      /CREATE TYPE public\.contact_category AS ENUM \([\s\S]*?'prospect'/,
    )
  })

  it('uses potential_client taxonomy and Manual Contact channel constants', () => {
    expect(sql).toContain('potential_client')
    expect(sql).toContain("'Manual Contact'")
    expect(sql).toContain("'manual_contact'")
  })

  it('binds tokens to create/update purpose and update subjects', () => {
    expect(sql).toContain("operation IN ('create', 'update')")
    expect(sql).toContain('subject_lead_id')
    expect(sql).toContain('subject_household_id')
    expect(sql).toContain("t.operation = 'create'")
    expect(sql).toContain("t.operation = 'update'")
    expect(sql).toContain('t.subject_lead_id = p_lead_id')
  })

  it('gates Manual Contact writes via rpc_context and clears context', () => {
    expect(sql).toContain("set_config('crm.rpc_context', 'quick_add_contact', true)")
    expect(sql).toContain("set_config('crm.rpc_context', 'update_manual_contact', true)")
    expect(sql).toContain('crm_clear_rpc_context')
    expect(sql).toContain('QUICK_ADD:manual_contact_rpc_required')
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.leads')
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.households')
  })

  it('stores token_hash only and revokes direct token table access', () => {
    expect(sql).toContain('token_hash text NOT NULL')
    expect(sql).toContain("encode(extensions.digest(v_raw_token, 'sha256'), 'hex')")
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.quick_add_duplicate_tokens FROM authenticated',
    )
    expect(sql).toContain('GRANT ALL ON TABLE public.quick_add_duplicate_tokens TO service_role')
  })

  it('does not expand Activity writers', () => {
    expect(sql).not.toContain('INSERT INTO public.activities')
    expect(sql).not.toContain('record_crm_activity')
    expect(sql).not.toContain('crm_write_activity')
  })
})
