import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_029_CONTRACT_MARKERS,
  MIGRATION_029_FILENAME,
  MIGRATION_029_FORBIDDEN_MARKERS,
  MIGRATION_029_IDEMPOTENCY_ENFORCED,
  MIGRATION_029_METADATA_MAX_BYTES,
  MIGRATION_029_ONBOARDING_METADATA_ALLOWLIST,
  MIGRATION_029_TASK_METADATA_ALLOWLIST,
} from './migration029Contract'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', MIGRATION_029_FILENAME),
  'utf8',
)

describe('migration 029 security hardening contract', () => {
  it('records the approved migration filename', () => {
    expect(MIGRATION_029_FILENAME).toBe(
      '029_security_hardening_opportunities_and_relationships.sql',
    )
  })

  it('includes all required schema markers', () => {
    for (const marker of MIGRATION_029_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('forbids Migration 030, Task Completion, AI metadata, and broad RPC inputs', () => {
    for (const marker of MIGRATION_029_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
  })

  it('rewrites opportunity SELECT/UPDATE without assignee-only authorization', () => {
    const selectMatch = sql.match(
      /CREATE POLICY opportunities_select ON public\.opportunities[\s\S]*?;/,
    )
    const updateMatch = sql.match(
      /CREATE POLICY opportunities_update ON public\.opportunities[\s\S]*?;/,
    )
    expect(selectMatch?.[0]).not.toMatch(
      /assigned_advisor_id\s*=\s*public\.crm_advisor_id\(\)/,
    )
    expect(updateMatch?.[0]).not.toMatch(
      /assigned_advisor_id\s*=\s*public\.crm_advisor_id\(\)/,
    )
  })

  it('defines event-key RPC with server-derived fields and event-specific allowlists', () => {
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.record_crm_activity\([\s\S]*?\$\$;/,
    )
    expect(fnMatch?.[0]).toBeTruthy()
    expect(fnMatch?.[0]).toContain('p_event_key text')
    expect(fnMatch?.[0]).not.toContain('p_recommendation_id')
    expect(fnMatch?.[0]).toContain("v_title := 'Household Onboarding completed'")
    expect(fnMatch?.[0]).toContain("'visibility', 'internal'")
    expect(fnMatch?.[0]).toContain('occurred_at')
    expect(fnMatch?.[0]).toContain('now()')
    expect(fnMatch?.[0]).toMatch(/VALUES \([\s\S]*NULL,\s*v_uid/)
    for (const key of MIGRATION_029_TASK_METADATA_ALLOWLIST) {
      expect(fnMatch?.[0]).toContain(`'${key}'`)
    }
    for (const key of MIGRATION_029_ONBOARDING_METADATA_ALLOWLIST) {
      expect(fnMatch?.[0]).toContain(`'${key}'`)
    }
    expect(fnMatch?.[0]).toContain(String(MIGRATION_029_METADATA_MAX_BYTES))
  })

  it('does not claim durable Activity idempotency in Migration 029', () => {
    expect(MIGRATION_029_IDEMPOTENCY_ENFORCED).toBe(false)
    expect(sql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]{0,120}idempotency|UNIQUE\s*\([^)]*idempotency/i,
    )
    expect(sql).toContain('Soft idempotencyKey accepted but not uniquely enforced in 029')
  })

  it('records opportunity-scoped assignment history on active sync', () => {
    expect(sql).toContain('opportunity_assignment_history_rows')
    expect(sql).toContain('AND opportunity_id = v_opp.id')
  })

  it('keeps temporary authenticated Activity INSERT via deterministic grant rewrite', () => {
    const revokeIdx = sql.indexOf(
      'REVOKE ALL ON TABLE public.activities FROM authenticated',
    )
    const grantIdx = sql.indexOf(
      'GRANT SELECT, INSERT ON TABLE public.activities TO authenticated',
    )
    expect(revokeIdx).toBeGreaterThan(-1)
    expect(grantIdx).toBeGreaterThan(revokeIdx)
  })

  it('uses a single non-enumerating subject relationship error', () => {
    expect(sql).toContain('CRM029:subject_relationship_invalid')
    expect(sql).not.toContain('CRM029:opportunity_household_mismatch')
    expect(sql).not.toContain('CRM029:lead_household_mismatch')
  })
})
