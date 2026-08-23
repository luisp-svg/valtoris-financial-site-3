import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_NUMBERED_MIGRATIONS, MIGRATION_045_FILENAME } from './migration045Contract'
import { MIGRATION_046_FILENAME } from './migration046Contract'
import {
  CREDIT_REPAIR_PIPELINE_ID,
  CREDIT_REPAIR_VERTICAL_ID,
  MIGRATION_047_CONTRACT_MARKERS,
  MIGRATION_047_FILENAME,
  MIGRATION_047_FORBIDDEN_MARKERS,
  SERVICE_SALES_STAGE_CODES,
  STUDENT_LOANS_PIPELINE_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from './migration047Contract'

const root = resolve(process.cwd())
const migrationsDir = resolve(root, 'supabase/migrations')
const sql = readFileSync(resolve(migrationsDir, MIGRATION_047_FILENAME), 'utf8')

function numberedMigrations(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
}

describe('migration 047 credit repair / student loan sales catalog', () => {
  it('is the only 047 file, follows 046, and rejects 048', () => {
    expect(MIGRATION_047_FILENAME).toBe('047_credit_repair_student_loan_sales_catalog.sql')
    const files = numberedMigrations()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files).toHaveLength(47)
    expect(files[0]).toBe('001_extensions_and_enums.sql')
    expect(files[44]).toBe(MIGRATION_045_FILENAME)
    expect(files[45]).toBe(MIGRATION_046_FILENAME)
    expect(files[46]).toBe(MIGRATION_047_FILENAME)
    expect(files.filter((f) => f.startsWith('045_'))).toEqual([MIGRATION_045_FILENAME])
    expect(files.filter((f) => f.startsWith('046_'))).toEqual([MIGRATION_046_FILENAME])
    expect(files.filter((f) => f.startsWith('047_'))).toEqual([MIGRATION_047_FILENAME])
    expect(files.filter((f) => f.startsWith('048_'))).toEqual([])
  })

  it('seeds exact sales catalog ids, codes, pipelines, and stages without Enrolled', () => {
    for (const marker of MIGRATION_047_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
    expect(sql).toContain(CREDIT_REPAIR_VERTICAL_ID)
    expect(sql).toContain(STUDENT_LOANS_VERTICAL_ID)
    expect(sql).toContain(CREDIT_REPAIR_PIPELINE_ID)
    expect(sql).toContain(STUDENT_LOANS_PIPELINE_ID)
    expect(SERVICE_SALES_STAGE_CODES).toEqual([
      'identified',
      'consultation',
      'presented',
      'sold',
      'closed_lost',
    ])
    expect(sql).not.toMatch(/enroll/i)
  })

  it('is data-only and does not add fulfillment, insurance, or commission schema', () => {
    for (const marker of MIGRATION_047_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).toContain('public._seed_pipeline_stages')
    expect(sql).not.toContain('CREATE TABLE')
    expect(sql).not.toContain('ALTER TABLE')
  })
})
