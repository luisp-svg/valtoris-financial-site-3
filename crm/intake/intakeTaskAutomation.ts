import type { TaskPriority, TaskStatus } from '../tasks/types'
import type { IntakeConsentSummary } from './types'

export type FollowUpTaskAutomationStatus =
  | 'task_created'
  | 'task_not_required'
  | 'task_pending'
  | 'task_failed'
  | 'task_manually_created'

export type IntakeFollowUpTaskSummary = {
  taskId: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  assignedUserId: string | null
  assigneeName: string | null
  workflowType: 'review_initial_diagnostic' | 'resolve_possible_duplicate' | null
  sourceType: string | null
}

export type IntakeTaskAutomationSummary = {
  automationStatus: FollowUpTaskAutomationStatus | null
  task: IntakeFollowUpTaskSummary | null
  /** Compact queue indicators — never raw error categories. */
  indicators: IntakeTaskIndicator[]
  /** Safe owner-facing message when automation failed. */
  creationIssueMessage: string | null
  /** True when contact permission is false (separate from task chips). */
  noContactPermission: boolean
  duplicateResolutionRequired: boolean
  canRetry: boolean
}

export type IntakeTaskIndicator =
  | 'review_open'
  | 'review_complete'
  | 'duplicate_review'
  | 'task_issue'
  | 'unassigned'
  | 'no_contact_permission'

const AUTOMATION_STATUSES = new Set<string>([
  'task_created',
  'task_not_required',
  'task_pending',
  'task_failed',
  'task_manually_created',
])

export function normalizeFollowUpTaskAutomationStatus(
  value: unknown,
): FollowUpTaskAutomationStatus | null {
  if (typeof value !== 'string') return null
  return AUTOMATION_STATUSES.has(value) ? (value as FollowUpTaskAutomationStatus) : null
}

export function mapTaskStatusLabel(status: TaskStatus | null | undefined): string {
  if (!status) return 'No task'
  if (status === 'open' || status === 'in_progress') return 'Review open'
  if (status === 'done') return 'Review complete'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

export function formatTaskDueDate(value: string | null | undefined): string {
  if (!value) return 'No due date'
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function buildIntakeTaskAutomationSummary(input: {
  automationStatus: unknown
  taskRow: Record<string, unknown> | null
  consent: IntakeConsentSummary
  duplicateReviewPending: boolean
  isOwner: boolean
}): IntakeTaskAutomationSummary {
  const automationStatus = normalizeFollowUpTaskAutomationStatus(input.automationStatus)
  const task = mapFollowUpTaskRow(input.taskRow)
  const noContactPermission = input.consent.contactPermission !== true
  const indicators: IntakeTaskIndicator[] = []

  if (input.duplicateReviewPending || task?.workflowType === 'resolve_possible_duplicate') {
    if (task?.status === 'done') {
      /* resolved duplicate task */
    } else {
      indicators.push('duplicate_review')
    }
  }

  if (task) {
    if (task.status === 'open' || task.status === 'in_progress') {
      if (task.workflowType !== 'resolve_possible_duplicate') {
        indicators.push('review_open')
      }
    } else if (task.status === 'done') {
      indicators.push('review_complete')
    }
    if (!task.assignedUserId && (task.status === 'open' || task.status === 'in_progress')) {
      indicators.push('unassigned')
    }
  }

  if (automationStatus === 'task_failed' || automationStatus === 'task_pending') {
    indicators.push('task_issue')
  }

  if (noContactPermission) {
    indicators.push('no_contact_permission')
  }

  const creationIssueMessage =
    automationStatus === 'task_failed'
      ? 'Follow-up task needs attention.'
      : automationStatus === 'task_pending'
        ? 'Follow-up task needs attention.'
        : null

  return {
    automationStatus,
    task,
    indicators: [...new Set(indicators)],
    creationIssueMessage,
    noContactPermission,
    duplicateResolutionRequired: input.duplicateReviewPending,
    canRetry:
      input.isOwner &&
      (automationStatus === 'task_failed' ||
        (automationStatus === 'task_pending' && !task)),
  }
}

export function mapFollowUpTaskRow(
  row: Record<string, unknown> | null | undefined,
): IntakeFollowUpTaskSummary | null {
  if (!row || typeof row.id !== 'string') return null
  const status = row.status
  const priority = row.priority
  if (
    status !== 'open' &&
    status !== 'in_progress' &&
    status !== 'done' &&
    status !== 'cancelled'
  ) {
    return null
  }
  if (priority !== 'low' && priority !== 'medium' && priority !== 'high' && priority !== 'urgent') {
    return null
  }

  const workflow =
    row.workflow_type === 'review_initial_diagnostic' ||
    row.workflow_type === 'resolve_possible_duplicate'
      ? row.workflow_type
      : null

  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee
  const assigneeName =
    assignee && typeof assignee === 'object' && typeof (assignee as { full_name?: unknown }).full_name === 'string'
      ? String((assignee as { full_name: string }).full_name)
      : null

  return {
    taskId: row.id,
    title: typeof row.title === 'string' ? row.title : 'Follow-up task',
    status,
    priority,
    dueDate: typeof row.due_date === 'string' ? row.due_date : null,
    assignedUserId: typeof row.assigned_user_id === 'string' ? row.assigned_user_id : null,
    assigneeName,
    workflowType: workflow,
    sourceType: typeof row.source_type === 'string' ? row.source_type : null,
  }
}

export function intakeTaskIndicatorLabel(indicator: IntakeTaskIndicator): string {
  switch (indicator) {
    case 'review_open':
      return 'Review open'
    case 'review_complete':
      return 'Review complete'
    case 'duplicate_review':
      return 'Duplicate review'
    case 'task_issue':
      return 'Task issue'
    case 'unassigned':
      return 'Unassigned'
    case 'no_contact_permission':
      return 'No contact permission'
    default:
      return indicator
  }
}
