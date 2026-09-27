export const CASE_STAGES = {
  queued: 'Queued',
  in_progress: 'In progress',
  waiting_client: 'Waiting on client',
  waiting_provider: 'Waiting on provider',
  ready_to_complete: 'Ready to complete',
} as const
export const REQUIREMENT_STATUSES = {
  open: 'Open',
  scheduled: 'Scheduled',
  complete: 'Complete',
  waived: 'Waived',
  cancelled: 'Cancelled',
} as const
export const CASE_VIEWS = {
  all: 'All records',
  active: 'Active cases',
  overdue_follow_up: 'Overdue follow-up',
  overdue_requirements: 'Overdue requirements',
  waiting: 'Waiting cases',
  unassigned: 'Unassigned cases',
} as const
export type CaseView = keyof typeof CASE_VIEWS
export type CaseStage = keyof typeof CASE_STAGES
export type CaseRequirement = {
  id: string
  record_id: string
  label: string
  status: keyof typeof REQUIREMENT_STATUSES
  is_blocking: boolean
  assigned_user_id: string | null
  due_date: string | null
  scheduled_for: string | null
  revision: number
  completed_at: string | null
  waived_at: string | null
}
export type CaseAssignee = { id: string; display_name: string }
export function calendarToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function requirementOpen(q: Pick<CaseRequirement, 'status'>) {
  return q.status === 'open' || q.status === 'scheduled'
}
export function dueLabel(date: string | null, today = calendarToday()) {
  return !date
    ? 'No date set'
    : date < today
      ? `Overdue · ${date}`
      : date === today
        ? `Due today · ${date}`
        : date
}
export function requirementTransitions(status: CaseRequirement['status']) {
  if (status === 'cancelled') return ['cancelled'] as const
  if (status === 'complete' || status === 'waived')
    return [status, 'open'] as const
  return Object.keys(REQUIREMENT_STATUSES) as CaseRequirement['status'][]
}
