import { describe, expect, it } from 'vitest'
import {
  applyOverdueRequirementCounts,
  buildRequirementUpdateFields,
  canMutateRequirements,
  canSoftDeleteRequirement,
  countOverdueRequirements,
  formatOverdueRequirementLabel,
  historyVisibleForRequirement,
  isOpenRequirementOverdue,
  overdueRequirementCountsByApplicationId,
  partitionRequirementRows,
  pickBlockingRequirement,
  previewCommonRequirements,
  requirementCalendarToday,
  requirementDisplayLabel,
  requirementStatusActions,
  validateReopenReason,
  validateScheduledFor,
} from './requirementView'
import type { RequirementHistoryRow, RequirementRow, RequirementUrgencyRow } from './requirementTypes'

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

describe('overdue requirement rule', () => {
  const today = '2026-08-20'

  function urgency(over: Partial<RequirementUrgencyRow> = {}): RequirementUrgencyRow {
    return {
      application_id: 'a1',
      status: 'open',
      due_date: '2026-08-19',
      ...over,
    }
  }

  it('flags open and scheduled rows only when due_date is before today', () => {
    expect(isOpenRequirementOverdue(urgency({ status: 'open', due_date: '2026-08-19' }), today)).toBe(
      true,
    )
    expect(isOpenRequirementOverdue(urgency({ status: 'open', due_date: today }), today)).toBe(false)
    expect(isOpenRequirementOverdue(urgency({ status: 'open', due_date: '2026-08-21' }), today)).toBe(
      false,
    )
    expect(isOpenRequirementOverdue(urgency({ status: 'open', due_date: null }), today)).toBe(false)
    expect(
      isOpenRequirementOverdue(urgency({ status: 'scheduled', due_date: '2026-08-19' }), today),
    ).toBe(true)
    expect(
      isOpenRequirementOverdue(urgency({ status: 'scheduled', due_date: '2026-09-01' }), today),
    ).toBe(false)
  })

  it('does not use scheduled_for as the overdue trigger', () => {
    expect(
      isOpenRequirementOverdue(
        row({ status: 'scheduled', due_date: null, scheduled_for: '2026-08-01' }),
        today,
      ),
    ).toBe(false)
    expect(
      isOpenRequirementOverdue(
        row({ status: 'scheduled', due_date: '2026-08-21', scheduled_for: '2026-08-01' }),
        today,
      ),
    ).toBe(false)
  })

  it('excludes terminal and deleted rows', () => {
    expect(isOpenRequirementOverdue(urgency({ status: 'complete' }), today)).toBe(false)
    expect(isOpenRequirementOverdue(urgency({ status: 'waived' }), today)).toBe(false)
    expect(isOpenRequirementOverdue(urgency({ status: 'cancelled' }), today)).toBe(false)
    expect(
      isOpenRequirementOverdue(urgency({ status: 'open', deleted_at: '2026-08-19T00:00:00Z' }), today),
    ).toBe(false)
  })

  it('counts and maps overdue rows without copying labels onto summary items', () => {
    const rows: RequirementUrgencyRow[] = [
      urgency({ application_id: 'open-a', status: 'open', due_date: '2026-08-19' }),
      urgency({ application_id: 'open-a', status: 'scheduled', due_date: '2026-08-01' }),
      urgency({ application_id: 'open-a', status: 'complete', due_date: '2026-08-01' }),
      urgency({ application_id: 'other', status: 'open', due_date: today }),
    ]
    expect(countOverdueRequirements(rows, today)).toBe(2)
    const counts = overdueRequirementCountsByApplicationId(rows, today)
    expect(counts.get('open-a')).toBe(2)
    expect(counts.get('other')).toBeUndefined()
    const attached = applyOverdueRequirementCounts(
      [{ id: 'open-a' }, { id: 'other' }, { id: 'untouched' }],
      counts,
    )
    expect(attached).toEqual([
      { id: 'open-a', overdue_requirement_count: 2 },
      { id: 'other', overdue_requirement_count: 0 },
      { id: 'untouched', overdue_requirement_count: 0 },
    ])
    expect(formatOverdueRequirementLabel(1)).toBe('Overdue requirement')
    expect(formatOverdueRequirementLabel(2)).toBe('2 overdue requirements')
    expect(requirementCalendarToday(new Date('2026-08-20T15:00:00.000Z'))).toBe('2026-08-20')
  })

  it('partitions overdue, outstanding, and completed without treating complete as blocking', () => {
    const rows: RequirementRow[] = [
      row({ id: 'late', status: 'open', due_date: '2026-08-01' }),
      row({ id: 'open', status: 'open', due_date: '2026-08-28' }),
      row({ id: 'done', status: 'complete', due_date: '2026-08-01' }),
      row({ id: 'waived', status: 'waived', due_date: '2026-08-01' }),
    ]
    const grouped = partitionRequirementRows(rows, '2026-08-20')
    expect(grouped.overdue.map((item) => item.id)).toEqual(['late'])
    expect(grouped.outstanding.map((item) => item.id)).toEqual(['open'])
    expect(grouped.completed.map((item) => item.id)).toEqual(['done', 'waived'])
    expect(pickBlockingRequirement(rows, '2026-08-20')?.row.id).toBe('late')
    expect(
      pickBlockingRequirement(
        rows.filter((item) => item.id !== 'late'),
        '2026-08-20',
      )?.row.id,
    ).toBe('open')
    expect(pickBlockingRequirement([row({ id: 'done', status: 'complete' })], '2026-08-20')).toBeNull()
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
