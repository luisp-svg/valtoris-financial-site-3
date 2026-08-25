import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_044_FILENAME } from './migration044Contract'
import {
  EXPECTED_NUMBERED_MIGRATIONS,
  MIGRATION_045_CONTRACT_MARKERS,
  MIGRATION_045_FILENAME,
  MIGRATION_045_FORBIDDEN_MARKERS,
} from './migration045Contract'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_045_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

describe('migration 045 post-placement policy lifecycle contract', () => {
  it('is the only 045 file, follows 044, and is followed by 046 conversion', () => {
    expect(MIGRATION_045_FILENAME).toBe('045_policy_post_placement_lifecycle.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(52)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[43]).toBe(MIGRATION_044_FILENAME)
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe('046_opportunity_case_conversion.sql')
    expect(files[46]).toBe('047_credit_repair_student_loan_sales_catalog.sql')
    expect(files[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(files.filter((f) => f.startsWith('045_'))).toEqual([MIGRATION_045_FILENAME])
    expect(files.filter((f) => f.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([
      '047_credit_repair_student_loan_sales_catalog.sql',
    ])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([
      '048_student_loan_report_card_ingest.sql',
    ])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((f) => f.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual([])
  })

  it('adds termination facts, linked status check, owner RPC, audit, and a narrow link-guard context', () => {
    for (const marker of MIGRATION_045_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('does not alter application stages, write commissions, or backfill rows', () => {
    for (const marker of MIGRATION_045_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toMatch(/ALTER TYPE public\.policy_application_stage/)
    expect(sql).not.toContain('record_policy_writing_commission_event')
    expect(sql).not.toContain('pp_refresh_application_expected_compensation')
    expect(sql).not.toContain('set_policy_application_writing_receivable_expected')
    expect(sql).not.toContain('UPDATE public.policy_applications')
    expect(sql).not.toMatch(/'chargeback'/)
  })

  it('keeps issue/in-force synchronization on the existing transition RPC context', () => {
    expect(sql).toContain("v_ctx = 'transition_policy_application_stage'")
    expect(sql).toContain('record_policy_post_placement_outcome')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.transition_policy_application_stage')
  })

  it('does not expose the owner lifecycle RPC outside the dedicated Case writer', () => {
    const surfaces = [
      'crm/production/applicationApi.ts',
      'crm/production/productionApi.ts',
      'crm/production/types.ts',
      'crm/production/caseOperationsView.ts',
      'crm/production/boardView.ts',
      'crm/production/dashboardView.ts',
      'crm/commissions/commissionWriteApi.ts',
      'pages/crm/CrmProductionPage.tsx',
      'pages/crm/CrmProductionEditPage.tsx',
    ]
    for (const rel of surfaces) {
      const body = readFileSync(resolve(root, rel), 'utf8')
      expect(body, rel).not.toContain('record_policy_post_placement_outcome')
    }
    const detail = readFileSync(resolve(root, 'pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
    const writer = readFileSync(resolve(root, 'crm/production/policyLifecycleApi.ts'), 'utf8')
    const section = readFileSync(resolve(root, 'crm/production/PolicyLifecycleSection.tsx'), 'utf8')
    expect(detail).toContain('PolicyLifecycleSection')
    expect(detail).not.toContain('record_policy_post_placement_outcome')
    expect(writer).toContain("export const POLICY_LIFECYCLE_RPC = 'record_policy_post_placement_outcome'")
    expect(section).toContain('recordPolicyPostPlacementOutcome')
    const stages = readFileSync(resolve(root, 'crm/production/types.ts'), 'utf8')
    expect(stages).toContain("'in_force'")
    expect(stages).not.toMatch(/PRODUCTION_STAGES = \[[^\]]*canceled/s)
    expect(stages).not.toMatch(/PRODUCTION_STAGES = \[[^\]]*surrendered/s)
  })
})
