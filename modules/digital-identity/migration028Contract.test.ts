import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_028_CONTRACT_MARKERS,
  MIGRATION_028_FILENAME,
  MIGRATION_028_FORBIDDEN_MARKERS,
  MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS,
  MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE,
} from './migration028Contract'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', MIGRATION_028_FILENAME),
  'utf8',
)

describe('migration 028 digital identity campaign attribution contract', () => {
  it('records the approved migration filename', () => {
    expect(MIGRATION_028_FILENAME).toBe('028_digital_identity_campaign_attribution.sql')
  })

  it('includes all required schema markers', () => {
    for (const marker of MIGRATION_028_CONTRACT_MARKERS) {
      expect(sql).toContain(marker)
    }
  })

  it('enforces ends_at lifecycle and jsonb object checks', () => {
    expect(sql).toContain('digital_card_campaigns_lifecycle_ends_after_starts_check')
    expect(sql).toMatch(/ends_at\s*>=\s*starts_at/)
    expect(sql).toContain("jsonb_typeof(last_touch_source_metadata) = 'object'")
  })

  it('does not add household last-touch, new status, events table, anon grants, or 029', () => {
    for (const marker of MIGRATION_028_FORBIDDEN_MARKERS) {
      expect(sql).not.toContain(marker)
    }
    expect(sql).not.toMatch(/status IN \([^)]*'archived'/)
    expect(sql).not.toContain('TO anon')
  })

  it('adds a narrowly scoped BEFORE UPDATE immutability trigger for campaign identifiers', () => {
    expect(sql).toContain('enforce_immutable_digital_card_campaign_identifiers')
    expect(sql).toContain('digital_card_campaigns_immutable_identifiers')
    expect(sql).toContain('BEFORE UPDATE ON public.digital_card_campaigns')
    expect(sql).toMatch(/SET search_path\s*=\s*pg_catalog,\s*public,\s*extensions/)
    expect(sql).not.toMatch(
      /enforce_immutable_digital_card_campaign_identifiers[\s\S]{0,200}EXECUTE\s+format|EXECUTE\s+'/,
    )
    for (const code of MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS) {
      expect(sql).toContain(code)
    }
    expect(sql).toContain(`ERRCODE = '${MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE}'`)
    expect(MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE).toBe('22023')
  })

  it('keeps mutable descriptive and lifecycle fields outside the immutability checks', () => {
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.enforce_immutable_digital_card_campaign_identifiers\(\)[\s\S]*?\$\$;/,
    )
    expect(fnMatch).toBeTruthy()
    const fnBody = fnMatch?.[0] ?? ''
    expect(fnBody).not.toMatch(/NEW\.label IS DISTINCT FROM/)
    expect(fnBody).not.toMatch(/NEW\.description IS DISTINCT FROM/)
    expect(fnBody).not.toMatch(/NEW\.status IS DISTINCT FROM/)
    expect(fnBody).not.toMatch(/NEW\.deleted_at IS DISTINCT FROM/)
    expect(fnBody).not.toMatch(/NEW\.advisor_notes IS DISTINCT FROM/)
    expect(fnBody).toContain('IS DISTINCT FROM')
  })
})
