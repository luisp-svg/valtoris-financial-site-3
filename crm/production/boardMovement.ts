/**
 * Production Board movement — UX projection of allowedNextStages.
 * The transition_policy_application_stage RPC remains authoritative.
 * Drag and Move to... share this helper. No multi-hop. No client-side stage writes.
 */
import type { CrmSupportedRole } from '../types'
import { boardColumnLabel } from './boardView'
import { formatProductionStageLabel } from './labels'
import {
  allowedNextStages,
  isProductionStage,
  stageTransitionAction,
  type StageTransitionAction,
} from './stageTransitionView'
import { formatStageTransitionUserError, STAGE_TRANSITION_GENERIC_ERROR } from './stageTransitionErrors'
import type { ProductionApplicationListItem, ProductionStage } from './types'

export const STALE_BOARD_REFRESH_MESSAGE =
  'This case changed since the board was loaded. Production has been refreshed.'

export function boardDroppableId(stage: string): string {
  return `stage:${stage}`
}

export function parseBoardDroppableStage(id: string | number | null | undefined): ProductionStage | null {
  if (id == null) return null
  const value = String(id)
  if (!value.startsWith('stage:')) return null
  const stage = value.slice('stage:'.length)
  return isProductionStage(stage) ? stage : null
}

export function boardDraggableId(applicationId: string): string {
  return `app:${applicationId}`
}

export function parseBoardDraggableApplicationId(
  id: string | number | null | undefined,
): string | null {
  if (id == null) return null
  const value = String(id)
  if (!value.startsWith('app:')) return null
  const applicationId = value.slice('app:'.length).trim()
  return applicationId || null
}

export function boardMoveDestinations(
  item: Pick<
    ProductionApplicationListItem,
    'production_stage' | 'deleted_at' | 'delivery_status'
  >,
  role: CrmSupportedRole | null,
): ProductionStage[] {
  return allowedNextStages({
    from: item.production_stage,
    role,
    deletedAt: item.deleted_at,
    deliveryStatus: item.delivery_status,
  })
}

export function isLegalBoardMove(
  item: Pick<
    ProductionApplicationListItem,
    'production_stage' | 'deleted_at' | 'delivery_status'
  >,
  toStage: ProductionStage | string | null | undefined,
  role: CrmSupportedRole | null,
): boolean {
  if (!isProductionStage(toStage)) return false
  if (item.production_stage === toStage) return false
  return boardMoveDestinations(item, role).includes(toStage)
}

export function boardMoveAction(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'policy_number'>,
  toStage: ProductionStage,
): StageTransitionAction {
  return stageTransitionAction(item.production_stage, toStage, {
    policyNumber: item.policy_number,
  })
}

export function boardMoveNeedsConfirmation(action: StageTransitionAction): boolean {
  return action.consequential || action.needsReason || action.needsPolicyNumber
}

export function boardMoveDestinationLabel(stage: ProductionStage): string {
  return boardColumnLabel(stage)
}

export function defaultBoardStageTransitionReason(to: ProductionStage): string {
  return `Updated from Production board — ${formatProductionStageLabel(to)}.`
}

export function isStaleBoardTransitionMessage(message: string | null | undefined): boolean {
  if (!message) return false
  return (
    message ===
    formatStageTransitionUserError({ message: 'CRM_PP:invalid_transition' })
  )
}

export type BoardMoveItem = Pick<
  ProductionApplicationListItem,
  'id' | 'production_stage' | 'deleted_at' | 'delivery_status' | 'policy_number'
>

export type BeginBoardMoveResult =
  | { kind: 'ignore' }
  | { kind: 'confirm'; action: StageTransitionAction }
  | { kind: 'execute'; action: StageTransitionAction }

export type BoardMoveOutcome =
  | { kind: 'success'; refetch: true; restore: false; followStage: ProductionStage; message: null }
  | { kind: 'stale'; refetch: true; restore: true; followStage: null; message: string }
  | { kind: 'error'; refetch: false; restore: true; followStage: null; message: string }

export function parseBoardOverStage(
  overId: string | number | null | undefined,
  items: Array<Pick<ProductionApplicationListItem, 'id' | 'production_stage'>>,
): ProductionStage | null {
  const fromColumn = parseBoardDroppableStage(overId)
  if (fromColumn) return fromColumn
  const applicationId = parseBoardDraggableApplicationId(overId)
  if (!applicationId) return null
  return items.find((row) => row.id === applicationId)?.production_stage ?? null
}

export function resolveBoardDropDestination(input: {
  activeId: string | number | null | undefined
  overId: string | number | null | undefined
  items: BoardMoveItem[]
  role: CrmSupportedRole | null
}): { item: BoardMoveItem; toStage: ProductionStage } | null {
  const applicationId = parseBoardDraggableApplicationId(input.activeId)
  const toStage = parseBoardOverStage(input.overId, input.items)
  if (!applicationId || !toStage) return null
  const item = input.items.find((row) => row.id === applicationId)
  if (!item) return null
  if (!isLegalBoardMove(item, toStage, input.role)) return null
  return { item, toStage }
}

export function beginBoardMove(
  item: BoardMoveItem,
  toStage: ProductionStage | string | null | undefined,
  role: CrmSupportedRole | null,
): BeginBoardMoveResult {
  if (!isLegalBoardMove(item, toStage, role) || !isProductionStage(toStage)) {
    return { kind: 'ignore' }
  }
  const action = boardMoveAction(item, toStage)
  if (boardMoveNeedsConfirmation(action)) return { kind: 'confirm', action }
  return { kind: 'execute', action }
}

export function buildBoardTransitionRpcArgs(
  item: Pick<ProductionApplicationListItem, 'id' | 'policy_number'>,
  action: StageTransitionAction,
  input: { reason: string; policyNumber: string },
): {
  applicationId: string
  toStage: ProductionStage
  reason: string
  fields: Record<string, unknown>
} {
  const policyNumber = input.policyNumber.trim() || item.policy_number?.trim() || ''
  const fields: Record<string, unknown> = {}
  if (action.toStage === 'issued' && policyNumber) {
    fields.policy_number = policyNumber
  }
  return {
    applicationId: item.id,
    toStage: action.toStage,
    reason: input.reason.trim() || defaultBoardStageTransitionReason(action.toStage),
    fields,
  }
}

export function interpretBoardMoveResult(
  ok: boolean,
  message: string | null | undefined,
  toStage: ProductionStage,
): BoardMoveOutcome {
  if (ok) {
    return { kind: 'success', refetch: true, restore: false, followStage: toStage, message: null }
  }
  if (isStaleBoardTransitionMessage(message)) {
    return {
      kind: 'stale',
      refetch: true,
      restore: true,
      followStage: null,
      message: STALE_BOARD_REFRESH_MESSAGE,
    }
  }
  return {
    kind: 'error',
    refetch: false,
    restore: true,
    followStage: null,
    message: message?.trim() || STAGE_TRANSITION_GENERIC_ERROR,
  }
}
