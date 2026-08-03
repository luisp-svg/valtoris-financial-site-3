import { describe, expect, it } from 'vitest'
import {
  MIGRATION_022_CONTRACT_MARKERS,
  MIGRATION_022_FORBIDDEN_MARKERS,
} from './migration022Contract'
import { PROPOSED_MIGRATION_022_FILENAME, PROPOSED_MIGRATION_022_REQUIRED } from './proposedMigration022'

describe('migration 022 contract', () => {
  it('records the applied migration filename and required schema markers', () => {
    expect(PROPOSED_MIGRATION_022_REQUIRED).toBe(false)
    expect(PROPOSED_MIGRATION_022_FILENAME).toBe('022_public_family_task_automation.sql')
    expect(MIGRATION_022_CONTRACT_MARKERS).toContain('create_public_family_follow_up_task')
    expect(MIGRATION_022_CONTRACT_MARKERS).toContain('review_initial_diagnostic')
    expect(MIGRATION_022_CONTRACT_MARKERS).toContain('resolve_possible_duplicate')
    expect(MIGRATION_022_CONTRACT_MARKERS).toContain('tasks_automation_idempotency_key_uidx')
    expect(MIGRATION_022_FORBIDDEN_MARKERS).toContain('contact_permitted_follow_up')
  })
})
