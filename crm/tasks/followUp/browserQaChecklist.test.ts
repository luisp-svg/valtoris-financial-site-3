import { describe, expect, it } from 'vitest'
import { PHASE6_FOLLOW_UP_QA_CHECKLIST } from './browserQaChecklist'
import { PROPOSED_MIGRATION_022_REQUIRED } from './proposedMigration022'

describe('Phase 6 QA checklist', () => {
  it('keeps migration 022 marked present and documents interactive QA', () => {
    expect(PROPOSED_MIGRATION_022_REQUIRED).toBe(false)
    expect(PHASE6_FOLLOW_UP_QA_CHECKLIST.length).toBeGreaterThan(5)
    expect(PHASE6_FOLLOW_UP_QA_CHECKLIST.some((item) => /Privacy Policy/i.test(item))).toBe(true)
  })
})
