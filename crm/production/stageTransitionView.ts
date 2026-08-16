/**
 * UX projection of Migration 032 pp_assert_transition_allowed.
 * The transition_policy_application_stage RPC remains authoritative.
 */
import type { CrmSupportedRole } from '../types'
import { formatProductionStageLabel } from './labels'
import type { ProductionDeliveryStatus, ProductionStage } from './types'
import { PRODUCTION_STAGES, PRODUCTION_TERMINAL_STAGES } from './types'

/** Outgoing edges from 032. Terminal stages have none. */
export const PRODUCTION_STAGE_TRANSITIONS: Record<ProductionStage, readonly ProductionStage[]> = {
  draft: ['pre_submitted', 'submitted', 'withdrawn'],
  pre_submitted: ['submitted', 'withdrawn'],
  submitted: ['in_underwriting', 'withdrawn', 'incomplete'],
  in_underwriting: ['submitted', 'approved', 'declined', 'postponed', 'withdrawn', 'incomplete'],
  postponed: ['in_underwriting', 'withdrawn', 'declined'],
  approved: ['in_underwriting', 'issued', 'not_taken', 'withdrawn'],
  issued: ['in_force', 'not_taken'],
  declined: [],
  withdrawn: [],
  incomplete: [],
  not_taken: [],
  in_force: [],
}

/** approved → in_underwriting is owner-only in 032. */
export const OWNER_ONLY_STAGE_TRANSITIONS: ReadonlyArray<{
  from: ProductionStage
  to: ProductionStage
}> = [{ from: 'approved', to: 'in_underwriting' }]

export const BACKWARD_STAGE_TRANSITIONS: ReadonlyArray<{
  from: ProductionStage
  to: ProductionStage
}> = [
  { from: 'in_underwriting', to: 'submitted' },
  { from: 'postponed', to: 'in_underwriting' },
  { from: 'approved', to: 'in_underwriting' },
]

const CONSEQUENTIAL_STAGES: readonly ProductionStage[] = [
  'submitted',
  'issued',
  'withdrawn',
  'declined',
  'not_taken',
  'incomplete',
  'in_force',
]

export type StageTransitionAction = {
  toStage: ProductionStage
  label: string
  confirmTitle: string
  confirmBody: string[]
  confirmLabel: string
  needsReason: boolean
  needsPolicyNumber: boolean
  consequential: boolean
}

export function isProductionStage(value: string | null | undefined): value is ProductionStage {
  return typeof value === 'string' && (PRODUCTION_STAGES as readonly string[]).includes(value)
}

export function isTerminalProductionStage(stage: ProductionStage | string | null | undefined): boolean {
  return (PRODUCTION_TERMINAL_STAGES as readonly string[]).includes(String(stage ?? ''))
}

export function isOwnerOnlyStageTransition(from: ProductionStage, to: ProductionStage): boolean {
  return OWNER_ONLY_STAGE_TRANSITIONS.some((edge) => edge.from === from && edge.to === to)
}

export function isBackwardStageTransition(from: ProductionStage, to: ProductionStage): boolean {
  return BACKWARD_STAGE_TRANSITIONS.some((edge) => edge.from === from && edge.to === to)
}

export function isConsequentialStageTransition(
  from: ProductionStage,
  to: ProductionStage,
): boolean {
  return isBackwardStageTransition(from, to) || CONSEQUENTIAL_STAGES.includes(to)
}

export function deliveryReadyForInForce(
  deliveryStatus: ProductionDeliveryStatus | string | null | undefined,
): boolean {
  return deliveryStatus === 'complete' || deliveryStatus === 'not_required'
}

export function allowedNextStages(options: {
  from: ProductionStage | string | null | undefined
  role: CrmSupportedRole | null
  deletedAt?: string | null
  deliveryStatus?: ProductionDeliveryStatus | string | null
}): ProductionStage[] {
  if (options.deletedAt) return []
  if (!isProductionStage(options.from)) return []
  if (options.role !== 'owner' && options.role !== 'advisor') return []
  const from = options.from

  return PRODUCTION_STAGE_TRANSITIONS[from].filter((to) => {
    if (options.role !== 'owner' && isOwnerOnlyStageTransition(from, to)) {
      return false
    }
    if (to === 'in_force' && !deliveryReadyForInForce(options.deliveryStatus)) {
      return false
    }
    return true
  })
}

export function canShowStageTransitionControls(options: {
  role: CrmSupportedRole | null
  from: ProductionStage | string | null | undefined
  deletedAt?: string | null
  deliveryStatus?: ProductionDeliveryStatus | string | null
}): boolean {
  return allowedNextStages(options).length > 0
}

export function stageTransitionAction(
  from: ProductionStage,
  to: ProductionStage,
  options?: { policyNumber?: string | null },
): StageTransitionAction {
  const label = actionLabel(from, to)
  const needsReason = isBackwardStageTransition(from, to)
  const needsPolicyNumber = to === 'issued' && !options?.policyNumber?.trim()
  return {
    toStage: to,
    label,
    confirmTitle: confirmTitle(to),
    confirmBody: confirmBody(from, to),
    confirmLabel: label,
    needsReason,
    needsPolicyNumber,
    consequential: isConsequentialStageTransition(from, to),
  }
}

export function shortestStagePath(
  from: ProductionStage,
  to: ProductionStage,
): ProductionStage[] | null {
  if (from === to) return []
  const queue: ProductionStage[][] = [[from]]
  const seen = new Set<ProductionStage>([from])
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const last = current[current.length - 1]
    for (const next of PRODUCTION_STAGE_TRANSITIONS[last]) {
      if (seen.has(next)) continue
      const path = [...current, next]
      if (next === to) return path.slice(1)
      seen.add(next)
      queue.push(path)
    }
  }
  return null
}

export function existingBusinessCatchUpStages(options?: { isOwner?: boolean }): ProductionStage[] {
  const allowed: ProductionStage[] = [
    'draft',
    'submitted',
    'in_underwriting',
    'approved',
    'issued',
    'postponed',
    'declined',
    'withdrawn',
    'incomplete',
    'not_taken',
  ]
  if (options?.isOwner) allowed.push('in_force')
  return allowed.filter((stage) => shortestStagePath('draft', stage) != null || stage === 'draft')
}

export function expectedCompensationDoesNotBlockSubmit(options: {
  from: ProductionStage
  expectedStatus?: string | null
}): boolean {
  void options.expectedStatus
  return allowedNextStages({
    from: options.from,
    role: 'owner',
  }).includes('submitted')
}

export function defaultStageTransitionReason(to: ProductionStage): string {
  return `Updated from Production detail — ${formatProductionStageLabel(to)}.`
}

function actionLabel(from: ProductionStage, to: ProductionStage): string {
  if (to === 'submitted') return 'Mark applied'
  if (to === 'issued') return 'Issue policy'
  if (to === 'in_force') return 'Place in force'
  if (to === 'withdrawn') return 'Mark withdrawn'
  if (to === 'declined') return 'Mark declined'
  if (to === 'not_taken') return 'Mark not taken'
  if (to === 'incomplete') return 'Mark incomplete'
  if (to === 'pre_submitted') return 'Mark pre-submitted'
  if (to === 'approved') return 'Mark approved'
  if (to === 'postponed') return 'Mark postponed'
  if (to === 'in_underwriting') {
    return isBackwardStageTransition(from, to) ? 'Return to underwriting' : 'Move to underwriting'
  }
  return `Move to ${formatProductionStageLabel(to)}`
}

function confirmTitle(to: ProductionStage): string {
  if (to === 'issued') return 'Issue this policy?'
  if (to === 'withdrawn') return 'Mark this application withdrawn?'
  if (to === 'declined') return 'Mark this application declined?'
  if (to === 'not_taken') return 'Mark this application not taken?'
  if (to === 'incomplete') return 'Mark this application incomplete?'
  if (to === 'in_force') return 'Place this policy in force?'
  if (to === 'submitted') return 'Mark this application applied?'
  return `Move this application to ${formatProductionStageLabel(to)}?`
}

function confirmBody(from: ProductionStage, to: ProductionStage): string[] {
  const lines = [
    `Current stage: ${formatProductionStageLabel(from)}. Next stage: ${formatProductionStageLabel(to)}.`,
  ]
  if (to === 'issued') {
    lines.push(
      'Issuing records the policy and finalizes expected compensation on the server. Expected compensation is not calculated in this screen.',
    )
  }
  if (to === 'submitted') {
    lines.push(
      'Submission is a Policy Production action. Unresolved expected compensation does not block a valid submit.',
    )
  }
  if (isBackwardStageTransition(from, to)) {
    lines.push('This returns the application to an earlier stage. A reason is required.')
  }
  if (to === 'in_force') {
    lines.push('Delivery must already be complete or marked not required.')
  }
  return lines
}
