import { describe, expect, it } from 'vitest'
import {
  MIGRATION_023_CONTRACT_MARKERS,
  PROPOSED_MIGRATION_023_FILENAME,
  PROPOSED_MIGRATION_023_REQUIRED,
} from './proposedMigration023'

describe('proposed migration 023 contract', () => {
  it('records the applied migration 023 filename and contract markers', () => {
    expect(PROPOSED_MIGRATION_023_REQUIRED).toBe(false)
    expect(PROPOSED_MIGRATION_023_FILENAME).toBe(
      '023_confirm_same_allows_ingest_resolve_task.sql',
    )
    expect(MIGRATION_023_CONTRACT_MARKERS).toContain('resolve_possible_duplicate')
    expect(MIGRATION_023_CONTRACT_MARKERS).toContain('CRM_DUP:unsafe_dependents')
  })
})
