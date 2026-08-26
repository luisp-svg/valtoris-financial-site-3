import { describe, expect, it } from 'vitest'
import { computeDaysInStage } from './daysInStage'
import { deriveCaseNextAction, CASE_NEXT_ACTION_PRECEDENCE } from './caseNextAction'
import type { RequirementRow } from './requirementTypes'

function requirement(over: Partial<RequirementRow> = {}): RequirementRow {
  return {
    id: 'r1',
    application_id: 'a1',
    requirement_code: 'aps',
    custom_label: null,
    status: 'open',
    due_date: '2026-08-18',
    scheduled_for: null,
    completed_at: null,
    waived_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

const now = new Date('2026-08-20T15:00:00.000Z')

function action(
  over: Partial<Parameters<typeof deriveCaseNextAction>[0]> = {},
) {
  return deriveCaseNextAction({
    productionStage: 'in_underwriting',
    productLine: 'life_term',
    deliveryStatus: 'pre_issue',
    submissionDate: '2026-06-15',
    deletedAt: null,
    nextFollowUpDate: null,
    requirements: { status: 'ready', rows: [] },
    now,
    ...over,
  })
}

describe('Case next-action derivation', () => {
  it('keeps a fixed precedence and does not persist a next_action field', () => {
    expect(CASE_NEXT_ACTION_PRECEDENCE).toEqual([
      'overdue_requirement',
      'outstanding_requirement',
      'overdue_follow_up',
      'scheduled_follow_up',
      'stage',
      'none',
    ])
  })

  it('prefers an overdue outstanding requirement over later signals', () => {
    const result = action({
      nextFollowUpDate: '2026-08-01',
      requirements: {
        status: 'ready',
        rows: [
          requirement({ id: 'done', status: 'complete', due_date: '2026-08-01' }),
          requirement({
            id: 'late',
            requirement_code: 'aps',
            status: 'open',
            due_date: '2026-08-18',
          }),
        ],
      },
    })
    expect(result.kind).toBe('overdue_requirement')
    expect(result.title).toBe('Carrier requirement overdue')
    expect(result.detail).toContain('APS')
  })

  it('uses an outstanding requirement that is not overdue, and ignores completed rows', () => {
    const result = action({
      nextFollowUpDate: '2026-08-01',
      requirements: {
        status: 'ready',
        rows: [
          requirement({ id: 'done', status: 'complete', due_date: '2026-08-01' }),
          requirement({
            id: 'open',
            requirement_code: 'signature',
            status: 'open',
            due_date: '2026-08-28',
          }),
        ],
      },
    })
    expect(result.kind).toBe('outstanding_requirement')
    expect(result.title).toBe('Outstanding requirement')
    expect(result.detail).toContain('Signature')
    expect(result.detail).toContain('due')
  })

  it('detects overdue follow-up when no blocking requirement exists', () => {
    expect(action({ nextFollowUpDate: '2026-08-19' }).kind).toBe('overdue_follow_up')
    expect(action({ nextFollowUpDate: '2026-08-19' }).title).toBe('Follow-up overdue')
  })

  it('detects scheduled follow-up including today', () => {
    expect(action({ nextFollowUpDate: '2026-08-20' })).toMatchObject({
      kind: 'scheduled_follow_up',
      title: 'Follow up today',
    })
    expect(action({ nextFollowUpDate: '2026-08-22' })).toMatchObject({
      kind: 'scheduled_follow_up',
      title: 'Follow up scheduled',
    })
  })

  it('falls back to a factual stage action, then a safe empty state', () => {
    expect(action({ productionStage: 'approved' })).toMatchObject({
      kind: 'stage',
      title: 'Client action required',
      detail: 'Review approved offer',
    })
    expect(action({ productionStage: 'submitted' }).title).toBe('Monitor underwriting')
    expect(
      action({
        productionStage: 'issued',
        productLine: 'life_term',
        deliveryStatus: 'with_client',
      }).title,
    ).toBe('Complete delivery')
    expect(
      action({
        productionStage: 'issued',
        productLine: 'fia',
        deliveryStatus: 'not_started',
      }).title,
    ).toBe('Complete funding / issue')
    expect(
      action({
        productionStage: 'issued',
        deliveryStatus: 'complete',
        productLine: 'life_term',
      }).title,
    ).toBe('Place in force')
  })

  it('uses a safe empty state when a closed Case has no requirement or follow-up work', () => {
    expect(
      action({
        productionStage: 'declined',
        requirements: { status: 'ready', rows: [] },
        nextFollowUpDate: null,
      }),
    ).toMatchObject({
      kind: 'closed',
      title: 'No immediate action recorded',
    })
  })

  it('does not treat draft or pre_submitted as operational Cases', () => {
    expect(action({ productionStage: 'draft', submissionDate: null }).kind).toBe('not_a_case')
    expect(
      action({ productionStage: 'pre_submitted', submissionDate: '2026-06-15' }).kind,
    ).toBe('not_a_case')
  })

  it('keeps terminal submitted applications as closed Cases with an outcome', () => {
    expect(action({ productionStage: 'declined' })).toMatchObject({
      kind: 'closed',
      detail: 'Outcome: Declined',
    })
    expect(action({ productionStage: 'withdrawn' }).kind).toBe('closed')
    expect(action({ productionStage: 'not_taken' }).kind).toBe('closed')
    expect(action({ productionStage: 'in_force' }).kind).toBe('closed')
  })

  it('does not present missing requirements as a successful empty next action', () => {
    expect(action({ requirements: { status: 'loading' } }).kind).toBe('loading')
    expect(
      action({ requirements: { status: 'error', message: 'Unable to load requirements.' } }),
    ).toMatchObject({
      kind: 'error',
      title: 'Unable to load requirements.',
    })
  })

  it('uses list overdue counts when requirement rows were not loaded', () => {
    const result = action({
      requirements: { status: 'unavailable' },
      overdueRequirementCount: 2,
      nextFollowUpDate: '2026-08-01',
    })
    expect(result.kind).toBe('overdue_requirement')
    expect(result.title).toBe('Carrier requirement overdue')
  })

  it('reuses computeDaysInStage without a second stale algorithm', () => {
    const days = computeDaysInStage({
      productionStage: 'in_underwriting',
      stageHistory: [
        {
          id: 'h1',
          from_stage: 'submitted',
          to_stage: 'in_underwriting',
          from_disposition: null,
          to_disposition: null,
          from_delivery_status: null,
          to_delivery_status: null,
          reason: null,
          changed_by_user_id: null,
          changed_at: '2026-08-08T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-08-01T00:00:00.000Z',
      now,
    })
    expect(days.source).toBe('stage_history')
    expect(days.days).toBe(12)
  })
})
