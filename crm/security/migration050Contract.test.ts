import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'
import { MIGRATION_048_FILENAME } from './migration048Contract'
import { MIGRATION_049_FILENAME } from './migration049Contract'
import {
  EXISTING_PUBLIC_ASSESSMENT_TYPES,
  EXISTING_PUBLIC_LEAD_SOURCES,
  EXISTING_PUBLIC_LEAD_TYPES,
  MIGRATION_050_ACTIVITY_SOURCE,
  MIGRATION_050_ASSESSMENT_TYPE,
  MIGRATION_050_CONTRACT_MARKERS,
  MIGRATION_050_COPY,
  MIGRATION_050_FILENAME,
  MIGRATION_050_FORBIDDEN_MARKERS,
  MIGRATION_050_FUNCTIONS,
  MIGRATION_050_LEAD_SOURCE,
  MIGRATION_050_LEAD_TYPE,
} from './migration050Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql050 = readFileSync(resolve(migrationsDir, MIGRATION_050_FILENAME), 'utf8')
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

describe('migration 050 credit report card ingest enablement', () => {
  it('is the only 050 file, follows 049, freezes 001–050, is followed by 051, is followed by 052, and is followed by 053, and rejects 054', () => {
    expect(MIGRATION_050_FILENAME).toBe('050_credit_report_card_ingest.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(53)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe(MIGRATION_049_FILENAME)
    expect(files[49]).toBe(MIGRATION_050_FILENAME)
    expect(files[50]).toBe('051_intake_archive_workflow.sql')
    expect(files[51]).toBe('052_fix_intake_archive_activity_order.sql')
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([MIGRATION_047_FILENAME])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([MIGRATION_048_FILENAME])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual([MIGRATION_049_FILENAME])
    expect(files.filter((f) => f.startsWith('050_'))).toEqual([MIGRATION_050_FILENAME])
    expect(files.filter((f) => f.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual([])
  })

  it('adds credit to assessment_type and maps Credit Report Card lead_type / lead_source', () => {
    expect(MIGRATION_050_ASSESSMENT_TYPE).toBe('credit')
    expect(MIGRATION_050_LEAD_TYPE).toBe('Credit Report Card')
    expect(MIGRATION_050_LEAD_SOURCE).toBe('credit_report_card')
    expect(MIGRATION_050_ACTIVITY_SOURCE).toBe('public_credit_report_card')
    for (const marker of MIGRATION_050_CONTRACT_MARKERS) {
      expect(sql050).toContain(marker)
    }
    expect(sql050).toContain("ADD VALUE IF NOT EXISTS 'credit'")
    expect(sql050).not.toContain("ADD VALUE IF NOT EXISTS 'credit_repair'")
    expect(sql050).not.toContain("ADD VALUE IF NOT EXISTS 'credit_report_card'")
  })

  it('preserves Family, Business, Retirement, Protection, and Student Loan mappings', () => {
    expect(EXISTING_PUBLIC_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
    ])
    expect(EXISTING_PUBLIC_LEAD_TYPES).toEqual([
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      'Student Loan Report Card',
    ])
    expect(EXISTING_PUBLIC_LEAD_SOURCES).toEqual([
      'family_report_card',
      'business_report_card',
      'retirement_report_card',
      'protection_gap',
      'student_loan_report_card',
    ])
    for (const type of EXISTING_PUBLIC_ASSESSMENT_TYPES) {
      expect(sql050).toContain(`'${type}'`)
    }
    expect(sql050).toContain("WHEN 'family' THEN 'Family Report Card'")
    expect(sql050).toContain("WHEN 'student_loan' THEN 'Student Loan Report Card'")
    expect(sql050).toContain("WHEN 'student_loan' THEN 'student_loan_report_card'")
  })

  it('extends the three existing public functions and does not add a Credit RPC', () => {
    expect(MIGRATION_050_FUNCTIONS).toEqual([
      'ingest_public_report_card',
      'create_public_family_follow_up_task',
      'resolve_public_family_duplicate_review',
    ])
    expect((sql050.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(3)
    expect(createReplaceCount(sql050, 'ingest_public_report_card')).toBe(1)
    expect(createReplaceCount(sql050, 'create_public_family_follow_up_task')).toBe(1)
    expect(createReplaceCount(sql050, 'resolve_public_family_duplicate_review')).toBe(1)
    expect(sql050).not.toContain('CREATE OR REPLACE FUNCTION public.ingest_public_credit')
    expect(sql050).not.toContain('CREATE FUNCTION')
    const ingestAllow = sql050.match(
      /v_assessment_type NOT IN \(\s*'family', 'business', 'retirement', 'protection', 'student_loan', 'credit'\s*\)/,
    )
    expect(ingestAllow).not.toBeNull()
    expect(sql050).toContain(
      "OR v_assessment.assessment_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan', 'credit')",
    )
    expect(sql050).toContain("'Credit Report Card'")
  })

  it('specializes Credit follow-up title and activity copy without Family / IFD leakage', () => {
    expect(sql050).toContain(MIGRATION_050_COPY.product)
    expect(sql050).toContain("WHEN 'credit' THEN 'Credit Report Card'")
    expect(sql050).toContain("v_title := 'Review ' || v_product || ' and follow up'")
    expect(sql050).toContain("'Follow-up review task created for public ' || v_product || '.'")
    expect(sql050).toContain(MIGRATION_050_COPY.workflowType)
    expect(sql050).toContain("IF v_assessment.assessment_type = 'family' THEN")
    const creditProduct = sql050.indexOf("WHEN 'credit' THEN 'Credit Report Card'")
    expect(creditProduct).toBeGreaterThan(-1)
    const familyTitle = "v_title := 'Review Initial Financial Diagnostic and follow up'"
    expect(sql050).toContain(familyTitle)
    expect(sql050).toContain("IF v_assessment.assessment_type = 'family' THEN")
  })

  it('does not add tables, columns, Opportunities, bureau, dispute, or insurance/commission writes', () => {
    for (const marker of MIGRATION_050_FORBIDDEN_MARKERS) {
      expect(sql050).not.toContain(marker)
    }
    expect(sql050).not.toContain('CREATE TABLE')
    expect(sql050).not.toContain('ALTER TABLE')
    expect(sql050).not.toContain('INSERT INTO public.opportunities')
    expect(sql050).not.toContain('record_policy_writing_commission_event')
    expect(sql050).not.toContain('convert_opportunity_to_policy_application')
  })

  it('leaves the disabled credit_repair servicing module untouched', () => {
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('featureFlag: { enabled: false }')
    expect(sql050).not.toContain('credit_repair')
    expect(sql050).not.toContain('credit_repair_case')
    expect(sql050).not.toContain('credit.dispute.draft')
  })

  it('does not modify Migration 047, 048, or 049', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sha256(`supabase/migrations/${MIGRATION_049_FILENAME}`)).toBe(SHA_049)
  })
})
