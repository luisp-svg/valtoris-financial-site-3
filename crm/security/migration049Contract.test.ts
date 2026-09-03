import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import { MIGRATION_047_FILENAME } from './migration047Contract'
import { MIGRATION_048_FILENAME } from './migration048Contract'
import {
  MIGRATION_049_CONTRACT_MARKERS,
  MIGRATION_049_COPY,
  MIGRATION_049_FILENAME,
  MIGRATION_049_FORBIDDEN_MARKERS,
  MIGRATION_049_FUNCTION,
} from './migration049Contract'

const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql049 = readFileSync(resolve(migrationsDir, MIGRATION_049_FILENAME), 'utf8')
const sql047 = readFileSync(resolve(migrationsDir, MIGRATION_047_FILENAME), 'utf8')
const sql048 = readFileSync(resolve(migrationsDir, MIGRATION_048_FILENAME), 'utf8')

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

describe('migration 049 public report-card follow-up copy specialization', () => {
  it('is the only 049 file, follows 048, is followed by 050, is followed by 051, is followed by 052, and is followed by 053, is followed by 054, and rejects 055', () => {
    expect(MIGRATION_049_FILENAME).toBe('049_specialize_public_report_card_follow_up_copy.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(54)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files[47]).toBe(MIGRATION_048_FILENAME)
    expect(files[48]).toBe(MIGRATION_049_FILENAME)
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([MIGRATION_048_FILENAME])
    expect(files.filter((f) => f.startsWith('049_'))).toEqual([MIGRATION_049_FILENAME])
    expect(files.filter((f) => f.startsWith('050_'))).toEqual(['050_credit_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('051_'))).toEqual(['051_intake_archive_workflow.sql'])
    expect(files.filter((f) => f.startsWith('052_'))).toEqual(['052_fix_intake_archive_activity_order.sql'])
    expect(files.filter((f) => f.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((f) => f.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(files.filter((f) => f.startsWith('055_'))).toEqual([])
  })

  it('replaces the existing follow-up function and does not add a new RPC', () => {
    expect(MIGRATION_049_FUNCTION).toBe('create_public_family_follow_up_task')
    expect(createReplaceCount(sql049, MIGRATION_049_FUNCTION)).toBe(1)
    expect((sql049.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length).toBe(1)
    expect(sql049).not.toContain('CREATE FUNCTION')
    expect(sql049).toContain('p_assessment_id uuid')
    expect(sql049).toContain('p_workflow_type text')
    expect(sql049).toContain("p_creation_source text DEFAULT 'system'")
    expect(sql049).toContain('RETURNS jsonb')
  })

  it('specializes follow-up copy for all five public assessment types', () => {
    for (const marker of MIGRATION_049_CONTRACT_MARKERS) {
      expect(sql049).toContain(marker)
    }
    expect(sql049).toContain(MIGRATION_049_COPY.familyTitle)
    expect(sql049).toContain(MIGRATION_049_COPY.familyDescription)
    expect(sql049).toContain(MIGRATION_049_COPY.familyActivity)
    expect(sql049).toContain(MIGRATION_049_COPY.business)
    expect(sql049).toContain(MIGRATION_049_COPY.retirement)
    expect(sql049).toContain(MIGRATION_049_COPY.protection)
    expect(sql049).toContain(MIGRATION_049_COPY.studentLoan)
    expect(sql049).toContain("v_title := 'Review ' || v_product || ' and follow up'")
    expect(sql049).toContain("'Follow-up review task created for public ' || v_product || '.'")
    expect(sql049).toContain(MIGRATION_049_COPY.workflowType)
  })

  it('keeps Student Loan copy free of Family / Initial Financial Diagnostic wording', () => {
    const studentTitle = "v_title := 'Review ' || v_product || ' and follow up'"
    expect(sql049).toContain(studentTitle)
    expect(sql049).toContain("WHEN 'student_loan' THEN 'Student Loan Report Card'")
    expect(sql049).toContain("'Follow-up review task created for public ' || v_product || '.'")
    const familyOnlyTitle = "v_title := 'Review Initial Financial Diagnostic and follow up'"
    expect(sql049.indexOf(familyOnlyTitle)).toBeGreaterThan(-1)
    expect(sql049).toContain("IF v_assessment.assessment_type = 'family' THEN")
  })

  it('does not add diagnostic answers to the follow-up Activity', () => {
    expect(sql049).not.toContain('v_assessment.answers')
    expect(sql049).not.toContain("p_metadata")
    expect(sql049).toContain("'event', 'public_family_follow_up_task_created'")
    expect(sql049).toContain("'Follow-up review task created'")
    expect(sql049).not.toContain('derived_metrics')
    expect(sql049).not.toContain('servicer_name')
  })

  it('preserves workflow, idempotency, due-date, assignment, and privilege behavior', () => {
    expect(sql049).toContain("v_key := 'public_family:' || v_assessment.id::text || ':' || v_workflow")
    expect(sql049).toContain("v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 1")
    expect(sql049).toContain("v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 3")
    expect(sql049).toContain('v_priority := \'high\'')
    expect(sql049).toContain("v_priority := 'medium'")
    expect(sql049).toContain('p_workflow_type')
    expect(sql049).toContain('workflow_type')
    expect(sql049).toContain('assigned_user_id')
    expect(sql049).toContain('SECURITY DEFINER')
    expect(sql049).toContain('SET search_path = pg_catalog, public, extensions')
    expect(sql049).toContain('ALTER FUNCTION public.create_public_family_follow_up_task(uuid, text, text) OWNER TO postgres')
  })

  it('does not add tables, Opportunities, scoring, ingest, or insurance/commission writes', () => {
    for (const marker of MIGRATION_049_FORBIDDEN_MARKERS) {
      expect(sql049).not.toContain(marker)
    }
    expect(sql049).not.toContain('CREATE TABLE')
    expect(sql049).not.toContain('ALTER TABLE')
    expect(sql049).not.toContain('INSERT INTO public.opportunities')
  })

  it('does not modify Migration 047 or 048', () => {
    expect(sha256(`supabase/migrations/${MIGRATION_047_FILENAME}`)).toBe(SHA_047)
    expect(sha256(`supabase/migrations/${MIGRATION_048_FILENAME}`)).toBe(SHA_048)
    expect(sql047).not.toContain('049_')
    expect(sql048).not.toContain('049_')
    expect(sql048).toContain("v_title := 'Review Initial Financial Diagnostic and follow up'")
    expect(sql048).toContain('Internal review task created for a public Family Initial Financial Diagnostic.')
  })
})
