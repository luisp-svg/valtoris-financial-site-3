import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_035_FILENAME } from './migration035Contract'
import {
  MIGRATION_036_CONTRACT_MARKERS,
  MIGRATION_036_FILENAME,
  MIGRATION_036_FORBIDDEN_MARKERS,
} from './migration036Contract'
import { MIGRATION_037_FILENAME } from './migration037Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_036_FILENAME), 'utf8')

describe('migration 036 commission import reconciliation contract', () => {
  it('records the approved filename after 035', () => {
    expect(MIGRATION_036_FILENAME).toBe('036_commission_import_reconciliation.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_035_FILENAME)
    expect(files).toContain(MIGRATION_036_FILENAME)
    expect(files.indexOf(MIGRATION_036_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_035_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('036_'))).toEqual([MIGRATION_036_FILENAME])
    expect(files.filter((f) => f.startsWith('037_'))).toEqual([MIGRATION_037_FILENAME])
    expect(files.indexOf(MIGRATION_037_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_036_FILENAME),
    )
  })

  it('includes required schema, RPC, RLS, and comment markers', () => {
    for (const marker of MIGRATION_036_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids a second ledger, pending money, upline models, and the next migration', () => {
    for (const marker of MIGRATION_036_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('keeps review statuses as TEXT checks rather than enums', () => {
    expect(sql).toContain('ready_to_post')
    expect(sql).not.toMatch(/CREATE TYPE public\.commission_import/)
    expect(sql).not.toMatch(/event_type IN \([^)]*'pending'/)
    expect(sql).not.toMatch(/event_type IN \([^)]*'eligible'/)
    expect(sql).not.toMatch(/event_type IN \([^)]*'released'/)
  })

  it('keeps DML revoked, owner-only SELECT, and explicit execute grants', () => {
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.commission_import_batches TO authenticated',
    )
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.commission_import_rows TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_import_batches',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_import_rows',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.create_commission_import_batch(',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.post_commission_import_row(uuid, text)',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.pp_commission_import_source_row_key(',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.pp_commission_import_transaction_fingerprint(',
    )
    expect(sql).toContain('USING (public.crm_is_owner())')
  })

  it('posts through 035, does not invent carrier transaction ids, and does not parse PDFs', () => {
    expect(sql).toContain('record_policy_writing_commission_event')
    expect(sql).toContain('036:{batch_id}:{source_row_key}')
    expect(sql).toContain('transaction_fingerprint is never used as the 035 key')
    expect(sql).toContain('Carrier transaction ids stay NULL unless the source provided one')
    expect(sql).toContain('NULL,')
    expect(sql).toContain('036 is NOT a financial ledger')
    expect(sql).not.toContain('pdfplumber')
    expect(sql).not.toContain('Tesseract')
  })
})
