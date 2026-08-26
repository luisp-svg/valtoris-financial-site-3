/**
 * Deterministic Case next-action presentation from existing data only.
 * Does not persist a next_action field. Does not recommend work.
 */
import {
  isClosedPolicyCase,
  isOpenPolicyCase,
  formatCaseDeliveryStatusLabel,
  formatCaseStageLabel,
} from './caseWorkspace'
import { isFiaProductionLine } from './dashboardView'
import { followUpState, formatFollowUpStateLabel } from './daysInStage'
import { formatProductionDeliveryLabel } from './labels'
import { formatProductionDate } from './productionApi'
import {
  pickBlockingRequirement,
  requirementCalendarToday,
  requirementDisplayLabel,
} from './requirementView'
import type { RequirementRow } from './requirementTypes'
import type { ProductionStage } from './types'

export const CASE_NEXT_ACTION_PRECEDENCE = [
  'overdue_requirement',
  'outstanding_requirement',
  'overdue_follow_up',
  'scheduled_follow_up',
  'stage',
  'none',
] as const

export type CaseNextActionKind =
  | 'overdue_requirement'
  | 'outstanding_requirement'
  | 'overdue_follow_up'
  | 'scheduled_follow_up'
  | 'stage'
  | 'none'
  | 'not_a_case'
  | 'closed'
  | 'loading'
  | 'error'

export type CaseNextAction = {
  kind: CaseNextActionKind
  title: string
  detail: string | null
}

export type CaseRequirementsLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: readonly RequirementRow[] }
  | { status: 'unavailable' }

export type CaseNextActionInput = {
  productionStage: string
  productLine: string
  deliveryStatus: string
  submissionDate: string | null | undefined
  deletedAt?: string | null
  nextFollowUpDate: string | null | undefined
  requirements?: CaseRequirementsLoadState
  overdueRequirementCount?: number
  now?: Date
}

export function deriveCaseNextAction(input: CaseNextActionInput): CaseNextAction {
  const now = input.now ?? new Date()
  const caseItem = {
    production_stage: input.productionStage,
    submission_date: input.submissionDate,
    deleted_at: input.deletedAt,
  }

  if (!isOpenPolicyCase(caseItem) && !isClosedPolicyCase(caseItem)) {
    return {
      kind: 'not_a_case',
      title: 'Application is not yet a Case',
      detail: 'Draft and pre-submitted applications become Cases after submission.',
    }
  }

  if (isClosedPolicyCase(caseItem)) {
    return {
      kind: 'closed',
      title: 'No immediate action recorded',
      detail: `Outcome: ${formatCaseStageLabel(input.productionStage)}`,
    }
  }

  if (input.requirements?.status === 'loading') {
    return { kind: 'loading', title: 'Loading next action…', detail: null }
  }

  const blocking = blockingRequirementAction(input, now)
  if (blocking) return blocking

  const followUp = followUpAction(input.nextFollowUpDate, now)
  if (followUp) return followUp

  return stageDerivedAction(input)
}

function blockingRequirementAction(
  input: CaseNextActionInput,
  now: Date,
): CaseNextAction | null {
  if (input.requirements?.status === 'error') {
    return {
      kind: 'error',
      title: 'Unable to load requirements.',
      detail: followUpFallbackDetail(input.nextFollowUpDate, now),
    }
  }

  if (input.requirements?.status === 'ready') {
    const picked = pickBlockingRequirement(
      input.requirements.rows,
      requirementCalendarToday(now),
    )
    if (!picked) return null
    const due = picked.row.due_date
      ? `due ${formatProductionDate(picked.row.due_date)}`
      : null
    return {
      kind: picked.overdue ? 'overdue_requirement' : 'outstanding_requirement',
      title: picked.overdue ? 'Carrier requirement overdue' : 'Outstanding requirement',
      detail: due
        ? `${requirementDisplayLabel(picked.row)} — ${due}`
        : requirementDisplayLabel(picked.row),
    }
  }

  if ((input.overdueRequirementCount ?? 0) > 0) {
    return {
      kind: 'overdue_requirement',
      title: 'Carrier requirement overdue',
      detail: input.overdueRequirementCount === 1 ? '1 overdue requirement' : `${input.overdueRequirementCount} overdue requirements`,
    }
  }

  return null
}

function followUpAction(
  nextFollowUpDate: string | null | undefined,
  now: Date,
): CaseNextAction | null {
  const state = followUpState(nextFollowUpDate, now)
  if (state === 'none') return null
  const when = formatProductionDate(nextFollowUpDate)
  if (state === 'overdue') {
    return {
      kind: 'overdue_follow_up',
      title: 'Follow-up overdue',
      detail: when,
    }
  }
  return {
    kind: 'scheduled_follow_up',
    title: state === 'today' ? 'Follow up today' : 'Follow up scheduled',
    detail: when,
  }
}

function stageDerivedAction(input: CaseNextActionInput): CaseNextAction {
  const stage = input.productionStage as ProductionStage | string
  const stageLabel = formatCaseStageLabel(stage)

  if (stage === 'submitted' || stage === 'paramed' || stage === 'in_underwriting' || stage === 'postponed') {
    return {
      kind: 'stage',
      title: 'Monitor underwriting',
      detail: stageLabel,
    }
  }
  if (stage === 'approved') {
    return {
      kind: 'stage',
      title: 'Client action required',
      detail: 'Review approved offer',
    }
  }
  if (stage === 'sent_to_draft' || stage === 'premium_drafted') {
    return {
      kind: 'stage',
      title: 'Client action required',
      detail: stageLabel,
    }
  }
  if (stage === 'issued') {
    const lens = formatCaseDeliveryStatusLabel(input.productLine)
    const deliveryLabel = formatProductionDeliveryLabel(input.deliveryStatus)
    if (input.deliveryStatus === 'complete' || input.deliveryStatus === 'not_required') {
      return {
        kind: 'stage',
        title: 'Place in force',
        detail: `${lens}: ${deliveryLabel}`,
      }
    }
    return {
      kind: 'stage',
      title: isFiaProductionLine(input.productLine)
        ? 'Complete funding / issue'
        : 'Complete delivery',
      detail: `${lens}: ${deliveryLabel}`,
    }
  }

  return {
    kind: 'none',
    title: 'No immediate action recorded',
    detail: null,
  }
}

function followUpFallbackDetail(
  nextFollowUpDate: string | null | undefined,
  now: Date,
): string | null {
  const state = followUpState(nextFollowUpDate, now)
  if (state === 'none') return 'No follow-up scheduled.'
  return `${formatFollowUpStateLabel(state)} follow-up ${formatProductionDate(nextFollowUpDate)}`
}

export function compactCaseNextActionLine(action: CaseNextAction): string | null {
  if (
    action.kind === 'none' ||
    action.kind === 'loading' ||
    action.kind === 'not_a_case' ||
    action.kind === 'closed'
  ) {
    return null
  }
  return action.detail ? `${action.title} · ${action.detail}` : action.title
}
