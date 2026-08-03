import { describe, expect, it } from 'vitest'
import {
  MIGRATION_024_CONTRACT_MARKERS,
  PROPOSED_MIGRATION_024_FILENAME,
  PROPOSED_MIGRATION_024_REQUIRED,
} from './proposedMigration024'

describe('migration 024 contract', () => {
  it('records applied migration 024 filename and privilege/notes markers', () => {
    expect(PROPOSED_MIGRATION_024_REQUIRED).toBe(false)
    expect(PROPOSED_MIGRATION_024_FILENAME).toBe(
      '024_authenticated_crm_privileges_and_duplicate_notes_fix.sql',
    )
    expect(MIGRATION_024_CONTRACT_MARKERS).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.leads TO authenticated',
    )
    expect(MIGRATION_024_CONTRACT_MARKERS).toContain('Do NOT use chr(0)')
    expect(MIGRATION_024_CONTRACT_MARKERS).toContain('FROM anon')
  })
})
