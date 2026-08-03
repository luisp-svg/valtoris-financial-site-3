import { generatePublicFamilyTaskLanguage, type GeneratedTaskLanguage } from './taskLanguage'
import {
  buildPublicFamilyTaskIdempotencyKey,
  resolveContactPermissionState,
  workflowForMatchStatus,
  type FollowUpAutomationInput,
  type TaskAutomationDecision,
} from './workflowTypes'

export type PlannedPublicFamilyTask = {
  decision: Extract<TaskAutomationDecision, { shouldCreate: true }>
  language: GeneratedTaskLanguage
  idempotencyKey: string
}

/**
 * Conservative automation policy for public Family diagnostic follow-up tasks.
 * Only two automatic workflows: review_initial_diagnostic | resolve_possible_duplicate.
 */
export function decidePublicFamilyTaskAutomation(
  input: FollowUpAutomationInput,
): TaskAutomationDecision {
  if (input.householdDeletedAt) {
    return {
      shouldCreate: false,
      workflowType: null,
      reason: 'Household is soft-deleted; automatic tasks are not created.',
    }
  }

  if (input.householdMergedIntoId) {
    return {
      shouldCreate: false,
      workflowType: null,
      reason:
        'Household is merged into another record; automatic follow-up belongs on the canonical household after re-link.',
    }
  }

  const workflowType = workflowForMatchStatus(input.matchStatus, {
    resolutionAction: input.resolutionAction,
  })
  const contact = resolveContactPermissionState(input.consent)

  if (workflowType === 'resolve_possible_duplicate') {
    return {
      shouldCreate: true,
      workflowType,
      priority: 'high',
      dueInDays: 1,
      assignToUserId: null,
      reason: 'Possible match requires owner duplicate review before diagnostic follow-up.',
    }
  }

  const dueInDays = contact === 'granted' ? 1 : 3
  const priority = contact === 'granted' ? 'high' : 'medium'

  return {
    shouldCreate: true,
    workflowType: 'review_initial_diagnostic',
    priority,
    dueInDays,
    assignToUserId: input.assignedAdvisorUserId,
    reason:
      contact === 'denied'
        ? 'Create internal review-only task; contact permission was not granted.'
        : contact === 'unknown'
          ? 'Create diagnostic review task; contact permission is unavailable.'
          : 'Create diagnostic review task; contact permission was granted.',
  }
}

export function planPublicFamilyTask(input: {
  automation: FollowUpAutomationInput
  assessmentId: string
}): PlannedPublicFamilyTask | null {
  const decision = decidePublicFamilyTaskAutomation(input.automation)
  if (!decision.shouldCreate) return null

  const language = generatePublicFamilyTaskLanguage({
    matchStatus: input.automation.matchStatus,
    consent: input.automation.consent,
    workflowType: decision.workflowType,
  })

  return {
    decision,
    language,
    idempotencyKey: buildPublicFamilyTaskIdempotencyKey(
      input.assessmentId,
      decision.workflowType,
    ),
  }
}

/** Simple calendar-day due date (UTC date string YYYY-MM-DD). No holiday calendar. */
export function computeTaskDueDateIso(fromIso: string, dueInDays: number): string {
  const start = new Date(fromIso)
  if (Number.isNaN(start.getTime())) {
    const fallback = new Date()
    fallback.setUTCDate(fallback.getUTCDate() + dueInDays)
    return fallback.toISOString().slice(0, 10)
  }
  const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  due.setUTCDate(due.getUTCDate() + dueInDays)
  return due.toISOString().slice(0, 10)
}

export const TASK_AUTOMATION_STATUS_VALUES = [
  'task_created',
  'task_not_required',
  'task_pending',
  'task_failed',
  'task_manually_created',
] as const

export type TaskAutomationStatusValue = (typeof TASK_AUTOMATION_STATUS_VALUES)[number]
