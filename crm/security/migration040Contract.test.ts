import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_034_FILENAME } from './migration034Contract'
import { MIGRATION_035_FILENAME } from './migration035Contract'
import { MIGRATION_036_FILENAME } from './migration036Contract'
import { MIGRATION_039_FILENAME } from './migration039Contract'
import {
  MIGRATION_040_CONTRACT_MARKERS,
  MIGRATION_040_FILENAME,
  MIGRATION_040_FORBIDDEN_MARKERS,
} from './migration040Contract'
import { MIGRATION_041_FILENAME } from './migration041Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_040_FILENAME), 'utf8')
const sql034 = readFileSync(resolve(migrationsDir, MIGRATION_034_FILENAME), 'utf8')
const sql035 = readFileSync(resolve(migrationsDir, MIGRATION_035_FILENAME), 'utf8')
const sql036 = readFileSync(resolve(migrationsDir, MIGRATION_036_FILENAME), 'utf8')

describe('migration 040 commission pending import contract', () => {
  it('records the approved filename after 039', () => {
    expect(MIGRATION_040_FILENAME).toBe('040_commission_pending_import.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_039_FILENAME)
    expect(files).toContain(MIGRATION_040_FILENAME)
    expect(files.indexOf(MIGRATION_040_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_039_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('040_'))).toEqual([MIGRATION_040_FILENAME])
    expect(files.filter((f) => f.startsWith('041_'))).toEqual([MIGRATION_041_FILENAME])
    expect(files.indexOf(MIGRATION_041_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_040_FILENAME),
    )
  })

  it('includes required pending schema, RPC, RLS, and comment markers', () => {
    for (const marker of MIGRATION_040_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids 035 writes, paid-table reuse, posting RPCs, and the next migration', () => {
    for (const marker of MIGRATION_040_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('keeps Pending statuses as TEXT checks without Paid/posting values', () => {
    expect(sql).toContain("'accepted_pending'")
    expect(sql).not.toMatch(/pending_review_status IN \([^)]*ready_to_post/)
    expect(sql).not.toMatch(/pending_review_status IN \([^)]*'posted'/)
    expect(sql).not.toMatch(/pending_review_status IN \([^)]*'paid'/)
    expect(sql).not.toMatch(/pending_review_status IN \([^)]*'eligible'/)
    expect(sql).not.toMatch(/pending_review_status IN \([^)]*'released'/)
    expect(sql).not.toMatch(/CREATE TYPE public\.commission_pending/)
    expect(sql).not.toContain('current_pending_cents')
    expect(sql).not.toContain('posted_commission_event_id')
  })

  it('does not change 034, 035 event types, or 036 paid source_type', () => {
    expect(sql034).not.toContain('commission_pending_import')
    expect(sql035).not.toContain("event_type IN ('pending'")
    expect(sql035).toContain("event_type IN ('paid', 'adjustment', 'chargeback', 'recovery', 'reversal')")
    expect(sql036).toContain("source_type IN ('experior_paid_report')")
    expect(sql036).not.toContain('experior_pending_report')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event')
  })

  it('keeps DML revoked, owner-only SELECT, and explicit execute grants', () => {
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.commission_pending_import_batches TO authenticated',
    )
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.commission_pending_import_rows TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_pending_import_batches',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_pending_import_rows',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.create_commission_pending_import_batch(',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.stage_commission_pending_import_rows(uuid, jsonb)',
    )
    expect(sql).toContain('USING (public.crm_is_owner())')
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/)
  })
})
