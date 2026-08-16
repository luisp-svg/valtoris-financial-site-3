import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_036_FILENAME } from './migration036Contract'
import {
  MIGRATION_037_CONTRACT_MARKERS,
  MIGRATION_037_FILENAME,
  MIGRATION_037_FORBIDDEN_MARKERS,
} from './migration037Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_037_FILENAME), 'utf8')

describe('migration 037 client production workflow extensions contract', () => {
  it('records the approved filename after 036', () => {
    expect(MIGRATION_037_FILENAME).toBe('037_client_production_workflow_extensions.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_036_FILENAME)
    expect(files).toContain(MIGRATION_037_FILENAME)
    expect(files.indexOf(MIGRATION_037_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_036_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('037_'))).toEqual([MIGRATION_037_FILENAME])
    expect(files.filter((f) => f.startsWith('038_'))).toEqual([])
  })

  it('includes required stage, beneficiary, DOB, RLS, and RPC markers', () => {
    for (const marker of MIGRATION_037_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids commission-release stages, a second DOB column, SSN, and 038', () => {
    for (const marker of MIGRATION_037_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('keeps draft as application draft and does not add commission-release stages', () => {
    expect(sql).toContain('draft is application draft')
    expect(sql).toContain("'paramed'")
    expect(sql).toContain("'sent_to_draft'")
    expect(sql).toContain("'premium_drafted'")
    expect(sql).not.toMatch(/production_stage.*commission_released/)
    expect(sql).not.toMatch(/ADD VALUE[^;]*'(closed|pending|eligible|released)'/)
  })

  it('uses TEXT + CHECK beneficiary types and integer basis points', () => {
    expect(sql).toContain('beneficiary_type text NOT NULL')
    expect(sql).toContain("beneficiary_type IN ('primary', 'contingent')")
    expect(sql).toContain('percentage_bps integer NOT NULL')
    expect(sql).toContain('100% = 10000')
    expect(sql).not.toMatch(/CREATE TYPE public\.policy_beneficiary/)
  })

  it('does not store SSN, bank, medical, or beneficiary DOB, and does not alter compensation writers', () => {
    expect(sql).not.toMatch(/\bssn\b/i)
    expect(sql).not.toMatch(/social_security/i)
    expect(sql).not.toMatch(/bank_account|routing_number/i)
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.pp_refresh_application_expected_compensation')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.create_commission_import_batch')
    expect(sql).toContain('expected_compensation')
    expect(sql).toContain('Does not touch compensation')
  })

  it('extends quick_add_contact onto the existing household_members.date_of_birth column only', () => {
    expect(sql).toContain("'date_of_birth'")
    expect(sql).toContain('household_members.date_of_birth')
    expect(sql).not.toContain('ALTER TABLE public.household_members ADD')
    expect(sql.match(/date_of_birth date/g) ?? []).toEqual([])
  })

  it('keeps DML revoked, application-scoped SELECT, and explicit execute grants', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
    expect(sql).toContain(
      'GRANT SELECT ON TABLE public.policy_application_beneficiaries TO authenticated',
    )
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_beneficiaries FROM authenticated',
    )
    expect(sql).toContain('REVOKE ALL ON TABLE public.policy_application_beneficiaries FROM anon')
    expect(sql).toContain('REVOKE ALL ON TABLE public.policy_application_beneficiaries FROM PUBLIC')
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.set_policy_application_beneficiaries(uuid, jsonb, text)',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.set_policy_application_beneficiaries(uuid, jsonb, text)',
    )
  })
})
