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
import { MIGRATION_051_FILENAME } from './migration051Contract'
import { MIGRATION_052_FILENAME } from './migration052Contract'
import { MIGRATION_053_FILENAME } from './migration053Contract'
import {
  EXISTING_PUBLIC_ASSESSMENT_TYPES,
  EXISTING_PUBLIC_LEAD_SOURCES,
  EXISTING_PUBLIC_LEAD_TYPES,
  MIGRATION_054_ACTIVITY_SOURCE,
  MIGRATION_054_ASSESSMENT_TYPE,
  MIGRATION_054_CONTRACT_MARKERS,
  MIGRATION_054_COPY,
  MIGRATION_054_FILENAME,
  MIGRATION_054_FORBIDDEN_MARKERS,
  MIGRATION_054_FUNCTIONS,
  MIGRATION_054_LEAD_SOURCE,
  MIGRATION_054_LEAD_TYPE,
} from './migration054Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'
const SHA_053 = 'cf8e972adbb37fa74a7c0a9a5c01699d1390871293cd73a64c3582be455fe25c'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql054 = readFileSync(resolve(migrationsDir, MIGRATION_054_FILENAME), 'utf8')
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

describe('migration 054 home buyer report card ingest enablement', () => {
  it('is the only 054 file, follows 053, freezes 001–054, and rejects 055', () => {
    expect(MIGRATION_054_FILENAME).toBe('054_home_buyer_report_card_ingest.sql')
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
    expect(files[51]).toBe(MIGRATION_052_FILENAME)
    expect(files[52]).toBe(MIGRATION_053_FILENAME)
    expect(files[53]).toBe(MIGRATION_054_FILENAME)
    expect(files.filter((f) => f.startsWith('053_'))).toEqual([MIGRATION_053_FILENAME])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual([MIGRATION_054_FILENAME])
    expect(files.filter((f) => f.startsWith('055_'))).toEqual([])
  })

  it('adds home_buyer to assessment_type and maps Home Buyer Report Card lead_type / lead_source', () => {
    expect(MIGRATION_054_ASSESSMENT_TYPE).toBe('home_buyer')
    expect(MIGRATION_054_LEAD_TYPE).toBe('Home Buyer Report Card')
    expect(MIGRATION_054_LEAD_SOURCE).toBe('home_buyer_report_card')
    expect(MIGRATION_054_ACTIVITY_SOURCE).toBe('public_home_buyer_report_card')
    for (const marker of MIGRATION_054_CONTRACT_MARKERS) {
      expect(sql054).toContain(marker)
    }
    expect(sql054).toContain("ADD VALUE IF NOT EXISTS 'home_buyer'")
    expect(sql054).not.toContain("ADD VALUE IF NOT EXISTS 'credit'")
    expect(sql054).not.toContain("ADD VALUE IF NOT EXISTS 'home_buyer_report_card'")
  })

  it('preserves Family, Business, Retirement, Protection, Student Loan, and Credit mappings', () => {
    expect(EXISTING_PUBLIC_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
      'credit',
    ])
    expect(EXISTING_PUBLIC_LEAD_TYPES).toEqual([
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      'Student Loan Report Card',
      'Credit Report Card',
    ])
    expect(EXISTING_PUBLIC_LEAD_SOURCES).toEqual([
      'family_report_card',
      'business_report_card',
      'retirement_report_card',
      'protection_gap',
      'student_loan_report_card',
      'credit_report_card',
    ])
    for (const type of EXISTING_PUBLIC_ASSESSMENT_TYPES) {
      expect(sql054).toContain(`'${type}'`)
    }
    expect(sql054).toContain("WHEN 'family' THEN 'Family Report Card'")
    expect(sql054).toContain("WHEN 'student_loan' THEN 'Student Loan Report Card'")
    expect(sql054).toContain("WHEN 'credit' THEN 'Credit Report Card'")
    expect(sql054).toContain("WHEN 'credit' THEN 'credit_report_card'")
  })

  it('extends the three existing public functions and does not add a Home Buyer RPC', () => {
    expect(MIGRATION_054_FUNCTIONS).toEqual([
      'ingest_public_report_card',
      'create_public_family_follow_up_task',
      'resolve_public_family_duplicate_review',
    ])
    expect((sql054.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(3)
    expect(createReplaceCount(sql054, 'ingest_public_report_card')).toBe(1)
    expect(createReplaceCount(sql054, 'create_public_family_follow_up_task')).toBe(1)
    expect(createReplaceCount(sql054, 'resolve_public_family_duplicate_review')).toBe(1)
    expect(sql054).not.toContain('CREATE OR REPLACE FUNCTION public.ingest_public_home_buyer')
    expect(sql054).not.toContain('CREATE FUNCTION')
    const ingestAllow = sql054.match(
      /v_assessment_type NOT IN \(\s*'family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer'\s*\)/,
    )
    expect(ingestAllow).not.toBeNull()
    expect(sql054).toContain(
      "OR v_assessment.assessment_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer')",
    )
    expect(sql054).toContain("'Home Buyer Report Card'")
  })

  it('specializes Home Buyer follow-up title and activity copy without Family / IFD leakage', () => {
    expect(sql054).toContain(MIGRATION_054_COPY.product)
    expect(sql054).toContain("WHEN 'home_buyer' THEN 'Home Buyer Report Card'")
    expect(sql054).toContain("v_title := 'Review ' || v_product || ' and follow up'")
    expect(sql054).toContain("'Follow-up review task created for public ' || v_product || '.'")
    expect(sql054).toContain(MIGRATION_054_COPY.workflowType)
    expect(sql054).toContain("IF v_assessment.assessment_type = 'family' THEN")
    const homeBuyerProduct = sql054.indexOf("WHEN 'home_buyer' THEN 'Home Buyer Report Card'")
    expect(homeBuyerProduct).toBeGreaterThan(-1)
    expect(sql054).toContain("v_title := 'Review Initial Financial Diagnostic and follow up'")
  })

  it('does not add tables, columns, Opportunities, bureau, mortgage vertical, or credit-pull schema', () => {
    for (const marker of MIGRATION_054_FORBIDDEN_MARKERS) {
      expect(sql054).not.toContain(marker)
    }
    expect(sql054).not.toContain('CREATE TABLE')
    expect(sql054).not.toContain('ALTER TABLE')
    expect(sql054).not.toContain('INSERT INTO public.opportunities')
    expect(sql054).not.toContain('record_policy_writing_commission_event')
    expect(sql054).not.toContain('convert_opportunity_to_policy_application')
  })

  it('leaves the disabled credit_repair servicing module untouched', () => {
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('featureFlag: { enabled: false }')
    expect(sql054).not.toContain('credit_repair')
    expect(sql054).not.toContain('credit_repair_case')
  })

  it('does not modify Migrations 047–053', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sha256(`supabase/migrations/${MIGRATION_049_FILENAME}`)).toBe(SHA_049)
    expect(sha256(`supabase/migrations/${MIGRATION_050_FILENAME}`)).toBe(SHA_050)
    expect(sha256(`supabase/migrations/${MIGRATION_051_FILENAME}`)).toBe(SHA_051)
    expect(sha256(`supabase/migrations/${MIGRATION_052_FILENAME}`)).toBe(SHA_052)
    expect(sha256(`supabase/migrations/${MIGRATION_053_FILENAME}`)).toBe(SHA_053)
  })
})
