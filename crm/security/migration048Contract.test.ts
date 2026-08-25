import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'
import {
  EXISTING_PUBLIC_ASSESSMENT_TYPES,
  EXISTING_PUBLIC_LEAD_SOURCES,
  EXISTING_PUBLIC_LEAD_TYPES,
  MIGRATION_048_ASSESSMENT_TYPE,
  MIGRATION_048_CONTRACT_MARKERS,
  MIGRATION_048_FILENAME,
  MIGRATION_048_FORBIDDEN_MARKERS,
  MIGRATION_048_LEAD_SOURCE,
  MIGRATION_048_LEAD_TYPE,
} from './migration048Contract'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql048 = readFileSync(resolve(migrationsDir, MIGRATION_048_FILENAME), 'utf8')
const sql047 = readFileSync(resolve(migrationsDir, MIGRATION_047_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

describe('migration 048 student loan report card ingest enablement', () => {
  it('is the only 048 file, follows 047, is followed by 049–050, is followed by 051, is followed by 052, and rejects 053', () => {
    expect(MIGRATION_048_FILENAME).toBe('048_student_loan_report_card_ingest.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(52)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe('049_specialize_public_report_card_follow_up_copy.sql')
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([MIGRATION_047_FILENAME])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([MIGRATION_048_FILENAME])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual(['049_specialize_public_report_card_follow_up_copy.sql'])
    expect(files.filter((f) => f.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual([])
  })

  it('adds student_loan to assessment_type and maps lead_type / lead_source', () => {
    expect(MIGRATION_048_ASSESSMENT_TYPE).toBe('student_loan')
    expect(MIGRATION_048_LEAD_TYPE).toBe('Student Loan Report Card')
    expect(MIGRATION_048_LEAD_SOURCE).toBe('student_loan_report_card')
    for (const marker of MIGRATION_048_CONTRACT_MARKERS) {
      expect(sql048).toContain(marker)
    }
    expect(sql048).toContain("ADD VALUE IF NOT EXISTS 'student_loan'")
    expect(sql048).toContain("WHEN 'student_loan' THEN 'Student Loan Report Card'")
    expect(sql048).toContain("WHEN 'student_loan' THEN 'student_loan_report_card'")
  })

  it('preserves Family, Business, Retirement, and Protection mappings', () => {
    expect(EXISTING_PUBLIC_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
    ])
    expect(EXISTING_PUBLIC_LEAD_TYPES).toEqual([
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
    ])
    expect(EXISTING_PUBLIC_LEAD_SOURCES).toEqual([
      'family_report_card',
      'business_report_card',
      'retirement_report_card',
      'protection_gap',
    ])
    for (const type of EXISTING_PUBLIC_ASSESSMENT_TYPES) {
      expect(sql048).toContain(`'${type}'`)
    }
    expect(sql048).toContain("WHEN 'family' THEN 'Family Report Card'")
    expect(sql048).toContain("WHEN 'business' THEN 'Business Report Card'")
    expect(sql048).toContain("WHEN 'retirement' THEN 'Retirement Report Card'")
    expect(sql048).toContain("WHEN 'protection' THEN 'Protection Gap'")
    expect(sql048).toContain("WHEN 'family' THEN 'family_report_card'")
    expect(sql048).toContain("WHEN 'business' THEN 'business_report_card'")
    expect(sql048).toContain("WHEN 'retirement' THEN 'retirement_report_card'")
    expect(sql048).toContain("WHEN 'protection' THEN 'protection_gap'")
  })

  it('extends existing ingest, follow-up, and duplicate-review paths without a new RPC', () => {
    expect(sql048).toContain('CREATE OR REPLACE FUNCTION public.ingest_public_report_card(p_payload jsonb)')
    expect(sql048).toContain('CREATE OR REPLACE FUNCTION public.create_public_family_follow_up_task(')
    expect(sql048).toContain('CREATE OR REPLACE FUNCTION public.resolve_public_family_duplicate_review(')
    expect(sql048).not.toContain('CREATE OR REPLACE FUNCTION public.ingest_public_student_loan')
    expect(sql048).not.toContain('CREATE OR REPLACE FUNCTION public.ingest_public_family_report_card')
    const ingestAllow = sql048.match(
      /v_assessment_type NOT IN \(\s*'family', 'business', 'retirement', 'protection', 'student_loan'\s*\)/,
    )
    expect(ingestAllow).not.toBeNull()
    expect(sql048).toContain(
      "OR v_assessment.assessment_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan')",
    )
    expect(sql048).toContain("'Student Loan Report Card'")
  })

  it('does not add tables, columns, Opportunities, insurance, or commission integration', () => {
    for (const marker of MIGRATION_048_FORBIDDEN_MARKERS) {
      expect(sql048).not.toContain(marker)
    }
    expect(sql048).not.toContain('CREATE TABLE')
    expect(sql048).not.toContain('ALTER TABLE')
    expect(sql048).not.toContain('INSERT INTO public.opportunities')
    expect(sql048).not.toContain('record_policy_writing_commission_event')
    expect(sql048).not.toContain('convert_opportunity_to_policy_application')
  })

  it('does not modify Migration 047', () => {
    expect(sql047).not.toContain('048_')
    expect(sql047).not.toMatch(/'student_loan'/)
    expect(sql047).not.toContain('Student Loan Report Card')
    expect(sql047).not.toContain('ALTER TYPE')
    expect(sql047).toContain('047_credit_repair_student_loan_sales_catalog.sql')
    expect(sql047).toContain("'student_loans'")
  })
})
