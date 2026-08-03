import { describe, expect, it } from 'vitest'
import {
  buildIntakeTaskAutomationSummary,
  formatTaskDueDate,
  intakeTaskIndicatorLabel,
  mapTaskStatusLabel,
} from './intakeTaskAutomation'
import { parseConsentSnapshot } from './intakeFormatters'

describe('intake task automation mapping', () => {
  it('maps open review task indicators without exposing raw errors', () => {
    const summary = buildIntakeTaskAutomationSummary({
      automationStatus: 'task_created',
      taskRow: {
        id: 'task-1',
        title: 'Review Initial Financial Diagnostic and follow up',
        status: 'open',
        priority: 'high',
        due_date: '2026-07-29',
        assigned_user_id: null,
        workflow_type: 'review_initial_diagnostic',
        source_type: 'public_family_ingest',
        assignee: null,
      },
      consent: parseConsentSnapshot({ contactPermission: true }),
      duplicateReviewPending: false,
      isOwner: true,
    })
    expect(summary.indicators).toContain('review_open')
    expect(summary.indicators).toContain('unassigned')
    expect(summary.creationIssueMessage).toBeNull()
    expect(summary.task?.title).toMatch(/follow up/i)
    expect(formatTaskDueDate(summary.task?.dueDate)).toMatch(/Jul/)
    expect(mapTaskStatusLabel('open')).toBe('Review open')
  })

  it('shows safe task issue for failed automation and enables owner retry', () => {
    const summary = buildIntakeTaskAutomationSummary({
      automationStatus: 'task_failed',
      taskRow: null,
      consent: parseConsentSnapshot({ contactPermission: false }),
      duplicateReviewPending: false,
      isOwner: true,
    })
    expect(summary.indicators).toContain('task_issue')
    expect(summary.indicators).toContain('no_contact_permission')
    expect(summary.creationIssueMessage).toBe('Follow-up task needs attention.')
    expect(summary.canRetry).toBe(true)
    expect(intakeTaskIndicatorLabel('task_issue')).toBe('Task issue')
  })

  it('flags duplicate review tasks separately from consent chips', () => {
    const summary = buildIntakeTaskAutomationSummary({
      automationStatus: 'task_created',
      taskRow: {
        id: 'task-dup',
        title: 'Resolve possible duplicate diagnostic submission',
        status: 'open',
        priority: 'high',
        due_date: '2026-07-29',
        assigned_user_id: 'user-1',
        workflow_type: 'resolve_possible_duplicate',
        source_type: 'public_family_ingest',
        assignee: { full_name: 'Owner One' },
      },
      consent: parseConsentSnapshot({ contactPermission: true }),
      duplicateReviewPending: true,
      isOwner: false,
    })
    expect(summary.indicators).toContain('duplicate_review')
    expect(summary.indicators).not.toContain('review_open')
    expect(summary.canRetry).toBe(false)
    expect(summary.task?.assigneeName).toBe('Owner One')
  })
})
