/**
 * Live CRM-dev READ for Migration 048 Student Loan ingest type enablement.
 * Hard-requires linked project-ref cxgiaevervjttbuiramd. Never targets CRM-prod.
 * Definition/catalog reads only. Does not create a public Student Loan submission.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXISTING_PUBLIC_ASSESSMENT_TYPES,
  MIGRATION_048_ASSESSMENT_TYPE,
  MIGRATION_048_LEAD_SOURCE,
  MIGRATION_048_LEAD_TYPE,
} from './migration048Contract'

const REQUIRED_REF = 'cxgiaevervjttbuiramd'

function linkedRef(): string | null {
  try {
    const ref = readFileSync(resolve(process.cwd(), 'supabase/.temp/project-ref'), 'utf8').trim()
    return ref || null
  } catch {
    return null
  }
}

function crmDevReady(): boolean {
  const ref = linkedRef()
  return ref === REQUIRED_REF && !/prod|production/i.test(ref)
}

function queryLinked(sql: string): Record<string, unknown>[] {
  const dir = mkdtempSync(join(tmpdir(), 'm048-crmdev-'))
  const file = join(dir, 'query.sql')
  writeFileSync(file, sql, 'utf8')
  try {
    const stdout = execSync(`npx supabase db query --linked --file ${JSON.stringify(file)} -o json`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed = JSON.parse(stdout) as unknown
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)) {
      return (parsed as { rows: Record<string, unknown>[] }).rows
    }
    throw new Error('unexpected supabase db query JSON shape')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!crmDevReady())('migration 048 CRM-dev ingest type enablement (cxgiaevervjttbuiramd only)', () => {
  it('enum contains student_loan exactly once and keeps existing values', () => {
    const rows = queryLinked(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'assessment_type'
      ORDER BY e.enumsortorder
    `)
    const labels = rows.map((row) => String(row.enumlabel))
    expect(labels.filter((label) => label === MIGRATION_048_ASSESSMENT_TYPE)).toHaveLength(1)
    for (const existing of EXISTING_PUBLIC_ASSESSMENT_TYPES) {
      expect(labels).toContain(existing)
    }
    expect(labels).toContain('household_onboarding')
    expect(labels.filter((label) => label === 'student_loans')).toHaveLength(0)
  })

  it('assessments.assessment_type remains NOT NULL', () => {
    const rows = queryLinked(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assessments'
        AND column_name = 'assessment_type'
    `)
    expect(rows).toEqual([{ is_nullable: 'NO' }])
  })

  it('ingest, follow-up, and duplicate-review definitions recognize student_loan mappings', () => {
    const rows = queryLinked(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'ingest_public_report_card',
          'create_public_family_follow_up_task',
          'resolve_public_family_duplicate_review'
        )
    `)
    const byName = Object.fromEntries(rows.map((row) => [String(row.proname), String(row.def)]))
    expect(Object.keys(byName).sort()).toEqual([
      'create_public_family_follow_up_task',
      'ingest_public_report_card',
      'resolve_public_family_duplicate_review',
    ])

    const ingest = byName.ingest_public_report_card
    expect(ingest).toContain(MIGRATION_048_ASSESSMENT_TYPE)
    expect(ingest).toContain(MIGRATION_048_LEAD_TYPE)
    expect(ingest).toContain(MIGRATION_048_LEAD_SOURCE)
    expect(ingest).toContain('Family Report Card')
    expect(ingest).toContain('Business Report Card')
    expect(ingest).toContain('Retirement Report Card')
    expect(ingest).toContain('Protection Gap')
    expect(ingest).not.toContain('INSERT INTO public.opportunities')
    expect(ingest).not.toMatch(/ingest_public_student_loan/)

    expect(byName.create_public_family_follow_up_task).toContain("'student_loan'")
    expect(byName.resolve_public_family_duplicate_review).toContain("'student_loan'")
    expect(byName.resolve_public_family_duplicate_review).toContain(MIGRATION_048_LEAD_TYPE)
  })
})
