import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_034_FILENAME } from './migration034Contract'
import {
  MIGRATION_035_CONTRACT_MARKERS,
  MIGRATION_035_FILENAME,
  MIGRATION_035_FORBIDDEN_MARKERS,
} from './migration035Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_035_FILENAME), 'utf8')

describe('migration 035 writing-advisor actual commission ledger contract', () => {
  it('records the approved filename after 034', () => {
    expect(MIGRATION_035_FILENAME).toBe('035_writing_advisor_actual_commission_ledger.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_034_FILENAME)
    expect(files).toContain(MIGRATION_035_FILENAME)
    expect(files.indexOf(MIGRATION_035_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_034_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('035_'))).toEqual([MIGRATION_035_FILENAME])
  })

  it('includes required schema, RPC, RLS, and comment markers', () => {
    for (const marker of MIGRATION_035_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids upline, pending money, import subsystem, and the next migration', () => {
    for (const marker of MIGRATION_035_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('uses TEXT event_type rather than a PostgreSQL enum', () => {
    expect(sql).toContain(
      "event_type IN ('paid', 'adjustment', 'chargeback', 'recovery', 'reversal')",
    )
    expect(sql).not.toMatch(/CREATE TYPE public\.commission_event_type/)
    expect(sql).not.toMatch(/CREATE TYPE public\.commission_status/)
  })

  it('keeps ledger DML revoked and owner/advisor execute grants explicit', () => {
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.policy_writing_commission_accounts TO authenticated',
    )
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.policy_writing_commission_events TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_writing_commission_accounts',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_writing_commission_events',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.record_policy_writing_commission_event(',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.pp_writing_commission_snapshot(uuid)',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.pp_record_writing_commission_event_internal(',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.pp_ensure_writing_commission_account(uuid, uuid, uuid)',
    )
  })

  it('documents writing-only, signed cents, pinning, and statement-scoped idempotency', () => {
    expect(sql).toContain('House and servicing')
    expect(sql).toContain('expected_cents_pinned')
    expect(sql).toContain('Never client-supplied')
    expect(sql).toContain('crm_write_audit')
    expect(sql).toContain('Carrier txn ids may repeat across statements')
    expect(sql).toContain('signed integer-cent')
    expect(sql).not.toMatch(/crm_can_access_household\(a\.household_id\)/)
    expect(sql).toContain('Authorization is enforced inside the function')
    expect(sql).toContain('Never randomly generated')
    expect(sql).toContain('API/request idempotency')
    expect(sql).not.toContain('v_key := extensions.gen_random_uuid()')
    expect(sql).not.toMatch(/event_type IN \([^)]*'pending'/)
    expect(sql).not.toMatch(/event_type IN \([^)]*'eligible'/)
    expect(sql).not.toMatch(/event_type IN \([^)]*'released'/)
  })
})
