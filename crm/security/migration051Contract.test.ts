import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'
import { MIGRATION_048_FILENAME } from './migration048Contract'
import { MIGRATION_049_FILENAME } from './migration049Contract'
import { MIGRATION_050_FILENAME } from './migration050Contract'
import {
  MIGRATION_051_CONTRACT_MARKERS,
  MIGRATION_051_DUPLICATE_WORKFLOWS,
  MIGRATION_051_FILENAME,
  MIGRATION_051_FORBIDDEN_MARKERS,
  MIGRATION_051_INTAKE_LEAD_TYPES,
  MIGRATION_051_ORDINARY_FOLLOW_UP_WORKFLOWS,
  MIGRATION_051_REASONS,
  MIGRATION_051_RPC,
} from './migration051Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql051 = readFileSync(resolve(migrationsDir, MIGRATION_051_FILENAME), 'utf8')
const catalog = readFileSync(resolve(root, 'platform/registry/catalog.ts'), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

function createReplaceCount(sql: string, name: string): number {
  return (sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'g')) ?? []).length
}

describe('migration 051 safe Intake archive RPC', () => {
  it('is the only 051 file, follows 050, freezes 001–052, is followed by 052, and is followed by 053, is followed by 054, and rejects 055', () => {
    expect(MIGRATION_051_FILENAME).toBe('051_intake_archive_workflow.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(54)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe(MIGRATION_049_FILENAME)
    expect(files[49]).toBe(MIGRATION_050_FILENAME)
    expect(files[50]).toBe(MIGRATION_051_FILENAME)
    expect(files[51]).toBe('052_fix_intake_archive_activity_order.sql')
    expect(files.filter((f) => f.startsWith('050_'))).toEqual([MIGRATION_050_FILENAME])
    expect(files.filter((f) => f.startsWith('051_'))).toEqual([MIGRATION_051_FILENAME])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('055_'))).toEqual([])
  })

  it('adds only archive_intake_lead with the approved signature and security posture', () => {
    expect(MIGRATION_051_RPC).toBe('archive_intake_lead')
    expect((sql051.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(1)
    expect(createReplaceCount(sql051, MIGRATION_051_RPC)).toBe(1)
    expect(sql051).toContain('archive_intake_lead(\n  p_lead_id uuid,\n  p_reason text\n)')
    expect(sql051).not.toContain('p_household_id')
    expect(sql051).not.toContain('CREATE FUNCTION')
    for (const marker of MIGRATION_051_CONTRACT_MARKERS) {
      expect(sql051).toContain(marker)
    }
  })

  it('allowlists Intake lead types and approved reasons only', () => {
    expect(MIGRATION_051_INTAKE_LEAD_TYPES).toEqual([
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      'Student Loan Report Card',
      'Credit Report Card',
      'Digital Identity',
    ])
    expect(MIGRATION_051_REASONS).toEqual([
      'dismissed',
      'not_a_fit',
      'spam',
      'test_or_accidental',
    ])
    for (const leadType of MIGRATION_051_INTAKE_LEAD_TYPES) {
      expect(sql051).toContain(`'${leadType}'`)
    }
    expect(sql051).toContain("'Manual Contact'")
    expect(sql051).toContain('CRM_INTAKE:not_intake_lead')
    expect(sql051).toContain('CRM_INTAKE:invalid_reason')
  })

  it('authorizes owner or assigned household access and ignores unassigned-pool visibility', () => {
    expect(sql051).toContain('public.crm_is_owner()')
    expect(sql051).toContain('public.crm_can_access_household(v_lead.household_id)')
    expect(sql051).not.toContain('crm_advisors_can_view_unassigned')
    expect(sql051).toContain('CRM_INTAKE:not_authorized')
    expect(sql051).toContain('CRM_INTAKE:already_archived')
  })

  it('blocks pending duplicate review and never completes duplicate workflows', () => {
    expect(sql051).toContain('CRM_INTAKE:duplicate_review_pending')
    expect(sql051).toContain("v_lead.status = 'duplicate_review'::public.lead_status")
    expect(sql051).toContain("dr.status = 'pending'")
    expect(MIGRATION_051_ORDINARY_FOLLOW_UP_WORKFLOWS).toEqual([
      'review_initial_diagnostic',
      'review_digital_identity_lead',
    ])
    expect(MIGRATION_051_DUPLICATE_WORKFLOWS).toEqual([
      'resolve_possible_duplicate',
      'resolve_digital_identity_duplicate',
    ])
    expect(sql051).toContain("'review_initial_diagnostic'")
    expect(sql051).toContain("'review_digital_identity_lead'")
    expect(sql051).toContain('workflow_type NOT IN (')
    expect(sql051).toContain("'resolve_possible_duplicate'")
    expect(sql051).toContain("'resolve_digital_identity_duplicate'")
    expect(sql051).not.toMatch(
      /UPDATE public\.tasks[\s\S]{0,240}workflow_type = 'resolve_possible_duplicate'/,
    )
    expect(sql051).not.toMatch(
      /UPDATE public\.tasks[\s\S]{0,240}workflow_type = 'resolve_digital_identity_duplicate'/,
    )
  })

  it('does not add tables, columns, hard row removal, Opportunities, Sheets, or ingest changes', () => {
    for (const marker of MIGRATION_051_FORBIDDEN_MARKERS) {
      expect(sql051).not.toContain(marker)
    }
    expect(sql051).not.toContain('CREATE TABLE')
    expect(sql051).not.toContain('ALTER TABLE')
    expect(sql051).not.toContain('DELETE FROM')
    expect(sql051).not.toContain('INSERT INTO public.opportunities')
    expect(sql051).not.toContain('INSERT INTO public.activities')
    expect(sql051).not.toContain('GRANT INSERT ON TABLE public.activities')
    expect(sql051).not.toContain('TO anon')
  })

  it('leaves the disabled credit_repair servicing module untouched', () => {
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('featureFlag: { enabled: false }')
    expect(sql051).not.toContain('credit_repair')
  })

  it('does not modify Migration 047, 048, 049, or 050', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sha256(`supabase/migrations/${MIGRATION_049_FILENAME}`)).toBe(SHA_049)
    expect(sha256(`supabase/migrations/${MIGRATION_050_FILENAME}`)).toBe(SHA_050)
  })
})
