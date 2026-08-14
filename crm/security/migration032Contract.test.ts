import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_031_FILENAME } from './migration031Contract'
import {
  MIGRATION_032_CONTRACT_MARKERS,
  MIGRATION_032_FILENAME,
  MIGRATION_032_FORBIDDEN_MARKERS,
} from './migration032Contract'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_032_FILENAME), 'utf8')

describe('migration 032 Policy Production P1A foundation contract', () => {
  it('records the approved migration filename after 031 and forbids 033', () => {
    expect(MIGRATION_032_FILENAME).toBe('032_policy_production_foundation.sql')
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort()
    expect(files).toContain(MIGRATION_031_FILENAME)
    expect(files).toContain(MIGRATION_032_FILENAME)
    expect(files.indexOf(MIGRATION_032_FILENAME)).toBeGreaterThan(
      files.indexOf(MIGRATION_031_FILENAME),
    )
    expect(files.filter((f) => f.startsWith('032_'))).toEqual([MIGRATION_032_FILENAME])
    expect(files.some((f) => f.startsWith('033_'))).toBe(false)
  })

  it('includes required schema, RPC, RLS, grant, and search_path markers', () => {
    for (const marker of MIGRATION_032_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids commission ledger, cases, requirements, Activity expansion, and 033', () => {
    for (const marker of MIGRATION_032_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('uses scoped enum names and house recipient type', () => {
    expect(sql).toContain('policy_application_stage')
    expect(sql).toContain('policy_underwriting_disposition')
    expect(sql).toContain('policy_delivery_status')
    expect(sql).toContain('insurance_product_line')
    expect(sql).toContain('policy_allocation_recipient_type')
    expect(sql).toContain("'advisor'")
    expect(sql).toContain("'house'")
    expect(sql).not.toMatch(/CREATE TYPE public\.production_stage AS ENUM/)
    expect(sql).not.toMatch(/CREATE TYPE public\.product_line AS ENUM/)
  })

  it('requires SECURITY DEFINER search_path including pg_catalog', () => {
    const definerBlocks = sql.match(
      /SECURITY DEFINER\s*\nSET search_path = [^\n]+/g,
    )
    expect(definerBlocks?.length).toBeGreaterThan(10)
    for (const block of definerBlocks || []) {
      expect(block).toContain('pg_catalog, public, extensions')
    }
  })

  it('grants SELECT-only on new tables and grants RPCs to authenticated', () => {
    expect(sql).toContain('GRANT SELECT ON TABLE')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE')
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.create_policy_application(jsonb)',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.transition_policy_application_stage(\n  uuid, text, text, text, text, jsonb\n)',
    )
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.create_policy_application(jsonb) FROM PUBLIC, anon',
    )
  })

  it('protects linked policies via trigger rather than revoking all policies DML', () => {
    expect(sql).toContain('enforce_policies_pp_link_guard')
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.policies')
    expect(sql).toContain('source_application_id')
    expect(sql).not.toContain('issued_policy_id')
  })

  it('uses unidirectional link and permanent source_application uniqueness', () => {
    expect(sql).toContain('policies_source_application_unique_idx')
    expect(sql).toContain(
      'ON public.policies (source_application_id)\n  WHERE source_application_id IS NOT NULL;',
    )
    expect(sql).not.toContain('AND deleted_at IS NULL;\n\nCOMMENT ON COLUMN public.policies.source_application_id')
    expect(sql).toContain('policy_applications_carrier_policy_number_unique_idx')
    expect(sql).toContain('pp_assert_in_force_delivery')
    expect(sql).toContain('duplicate_link')
  })

  it('documents FIA single-annuitant and no deposit-into-premium mapping', () => {
    expect(sql).toContain('exactly ONE current annuitant')
    expect(sql).toMatch(/policies\.premium is NEVER used/i)
    expect(sql).toContain('annuity_deposit_cents')
  })

  it('documents application-number correction audit via audit_logs only', () => {
    expect(sql).toContain('crm_write_audit')
    expect(sql).toContain('public.audit_logs')
    expect(sql).toContain('correct_policy_application_number')
    expect(sql).not.toContain('INSERT INTO public.activities')
  })
})
