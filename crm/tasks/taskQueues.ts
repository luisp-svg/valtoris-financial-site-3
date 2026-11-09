export type TaskQueue = 'sales' | 'internal' | 'operations'

/** Presentation-only classification. Never grants permission to contact a prospect. */
export function classifyTaskQueue(task: { source_type?: string | null; workflow_type?: string | null; metadata?: Record<string, unknown> | null }): TaskQueue {
  if (task.workflow_type === 'resolve_possible_duplicate') return 'internal'
  if (task.metadata?.contact_permission === false) return 'internal'
  if (task.source_type === 'manual' && task.workflow_type !== 'review_initial_diagnostic') return 'operations'
  if (task.workflow_type === 'review_initial_diagnostic' && task.metadata?.contact_permission === true) return 'sales'
  // Missing/ambiguous consent is never treated as sales-ready.
  return 'internal'
}

export const TASK_QUEUE_LABELS: Record<TaskQueue, string> = {
  sales: 'Sales follow-ups',
  internal: 'Internal reviews',
  operations: 'Client operations',
}

/** A deep link opens the target's queue; explicit tab changes remove the target. */
export function resolveTaskQueue(
  tasks: ReadonlyArray<{ id: string } & Parameters<typeof classifyTaskQueue>[0]>,
  queue: string | null,
  taskId: string | null,
): TaskQueue {
  const target = taskId ? tasks.find(task => task.id === taskId) : undefined
  if (target) return classifyTaskQueue(target)
  return queue === 'internal' || queue === 'operations' || queue === 'sales' ? queue : 'sales'
}
