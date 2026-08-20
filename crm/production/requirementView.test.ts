import { describe, expect, it } from 'vitest'
import {
  buildRequirementUpdateFields,
  canMutateRequirements,
  canSoftDeleteRequirement,
  historyVisibleForRequirement,
  isOpenRequirementOverdue,
  previewCommonRequirements,
  requirementDisplayLabel,
  requirementStatusActions,
  validateReopenReason,
  validateScheduledFor,
} from './requirementView'
import type { RequirementHistoryRow, RequirementRow } from './requirementTypes'

function row(over: Partial<RequirementRow> = {}): RequirementRow {
  return {
    id: 'r1',
    application_id: 'a1',
    requirement_code: 'signature',
    custom_label: null,
    status: 'open',
    due_date: null,
    scheduled_for: null,
    completed_at: null,
    waived_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

describe('requirement status actions', () => {
  it('matches the approved transition matrix and leaves cancelled with none', () => {
    expect(requirementStatusActions('open')).toEqual(['schedule', 'complete', 'waive', 'cancel'])
    expect(requirementStatusActions('scheduled')).toEqual([
      'return_to_open',
      'complete',
      'waive',
      'cancel',
    ])
    expect(requirementStatusActions('complete')).toEqual(['reopen'])
    expect(requirementStatusActions('waived')).toEqual(['reopen'])
    expect(requirementStatusActions('cancelled')).toEqual([])
  })

  it('keeps soft delete owner-only and blocks draft parents', () => {
    expect(canSoftDeleteRequirement('owner')).toBe(true)
    expect(canSoftDeleteRequirement('advisor')).toBe(false)
    expect(canMutateRequirements({ stage: 'submitted', deletedAt: null })).toBe(true)
    expect(canMutateRequirements({ stage: 'draft', deletedAt: null })).toBe(false)
    expect(canMutateRequirements({ stage: 'submitted', deletedAt: '2026-08-01T00:00:00Z' })).toBe(
      false,
    )
  })
})

describe('requirement dates', () => {
  it('requires scheduled_for when scheduling and keeps due date independent of status', () => {
    expect(validateScheduledFor('')).toBeTruthy()
    expect(validateScheduledFor('2026-09-01')).toBeNull()
    expect(isOpenRequirementOverdue(row({ status: 'open', due_date: '2026-08-01' }), '2026-08-20')).toBe(
      true,
    )
    expect(
      isOpenRequirementOverdue(row({ status: 'complete', due_date: '2026-08-01' }), '2026-08-20'),
    ).toBe(false)
    expect(isOpenRequirementOverdue(row({ status: 'open', due_date: null }), '2026-08-20')).toBe(false)
  })

  it('builds a strict update patch with only supplied keys', () => {
    expect(buildRequirementUpdateFields({ due_date: '2026-11-01' })).toEqual({
      due_date: '2026-11-01',
    })
    expect(buildRequirementUpdateFields({ scheduled_for: null })).toEqual({ scheduled_for: null })
    expect(Object.keys(buildRequirementUpdateFields({ custom_label: 'Carrier form' }))).toEqual([
      'custom_label',
    ])
  })
})

describe('common sets, labels, history, and reopen', () => {
  it('skips codes already present and uses other custom labels', () => {
    const preview = previewCommonRequirements('life_term', [row({ requirement_code: 'signature' })])
    expect(preview.toAdd).toEqual(['paramed_exam', 'illustration', 'initial_premium'])
    expect(preview.skipped).toEqual(['signature'])
    expect(requirementDisplayLabel(row({ requirement_code: 'other', custom_label: 'Carrier form' }))).toBe(
      'Carrier form',
    )
  })

  it('requires an operational reopen reason and hides soft-delete history', () => {
    expect(validateReopenReason('')).toBeTruthy()
    expect(validateReopenReason('x'.repeat(501))).toBeTruthy()
    expect(validateReopenReason('Carrier resent illustration')).toBeNull()
    const history: RequirementHistoryRow[] = [
      {
        id: 'h1',
        requirement_id: 'r1',
        from_status: null,
        to_status: 'open',
        reason: null,
        changed_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'h2',
        requirement_id: 'r1',
        from_status: 'open',
        to_status: 'open',
        reason: 'soft_delete',
        changed_at: '2026-08-02T00:00:00Z',
      },
    ]
    expect(historyVisibleForRequirement(history, 'r1').map((entry) => entry.id)).toEqual(['h1'])
  })
})
