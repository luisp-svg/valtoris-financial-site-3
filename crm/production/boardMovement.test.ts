import { describe, expect, it, vi } from 'vitest'
import {
  beginBoardMove,
  boardDraggableId,
  boardDroppableId,
  boardMoveDestinations,
  boardMoveNeedsConfirmation,
  buildBoardTransitionRpcArgs,
  defaultBoardStageTransitionReason,
  interpretBoardMoveResult,
  isLegalBoardMove,
  resolveBoardDropDestination,
  STALE_BOARD_REFRESH_MESSAGE,
} from './boardMovement'
import { formatStageTransitionUserError } from './stageTransitionErrors'
import { allowedNextStages, defaultStageTransitionReason } from './stageTransitionView'
import { applyProductionQueueView, defaultProductionQueueFilters } from './queueView'
import type { ProductionApplicationListItem, ProductionStage } from './types'

function item(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage'>,
): ProductionApplicationListItem {
  return {
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: null,
    policy_number: null,
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-06-15',
    next_follow_up_date: null,
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: 50000000,
    premium_mode: 'annual',
    issue_date: null,
    in_force_date: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    writing_receivable_expected: true,
    ...partial,
  }
}

async function attemptBoardDrop(input: {
  row: ProductionApplicationListItem
  toStage: ProductionStage
  role: 'owner' | 'advisor'
  rpc: (payload: ReturnType<typeof buildBoardTransitionRpcArgs>) => unknown
  confirmInput?: { reason: string; policyNumber: string }
}) {
  const destination = resolveBoardDropDestination({
    activeId: boardDraggableId(input.row.id),
    overId: boardDroppableId(input.toStage),
    items: [input.row],
    role: input.role,
  })
  if (!destination) return { rpcCalled: false as const, begin: null }
  const begin = beginBoardMove(destination.item, destination.toStage, input.role)
  if (begin.kind === 'ignore') return { rpcCalled: false as const, begin }
  if (begin.kind === 'confirm' && !input.confirmInput) {
    return { rpcCalled: false as const, begin }
  }
  const action = begin.action
  await input.rpc(
    buildBoardTransitionRpcArgs(
      input.row,
      action,
      input.confirmInput ?? { reason: '', policyNumber: input.row.policy_number ?? '' },
    ),
  )
  return { rpcCalled: true as const, begin }
}

describe('Phase C board movement matrix', () => {
  it('allows legal pipeline hops without multi-hop shortcuts', () => {
    const submitted = item({ id: 'app-sub', production_stage: 'submitted' })
    expect(isLegalBoardMove(submitted, 'paramed', 'owner')).toBe(true)
    expect(isLegalBoardMove(submitted, 'in_underwriting', 'owner')).toBe(true)
    expect(isLegalBoardMove(submitted, 'approved', 'owner')).toBe(true)
    expect(isLegalBoardMove(item({ id: 'a', production_stage: 'approved' }), 'sent_to_draft', 'owner')).toBe(
      true,
    )
    expect(
      isLegalBoardMove(item({ id: 's', production_stage: 'sent_to_draft' }), 'premium_drafted', 'owner'),
    ).toBe(true)
    expect(
      isLegalBoardMove(item({ id: 'd', production_stage: 'premium_drafted' }), 'issued', 'owner'),
    ).toBe(true)
    expect(
      isLegalBoardMove(
        item({ id: 'i', production_stage: 'issued', delivery_status: 'complete' }),
        'in_force',
        'owner',
      ),
    ).toBe(true)
    expect(isLegalBoardMove(item({ id: 'p', production_stage: 'postponed' }), 'in_underwriting', 'owner')).toBe(
      true,
    )
    expect(isLegalBoardMove(item({ id: 'd', production_stage: 'premium_drafted' }), 'in_force', 'owner')).toBe(
      false,
    )
    expect(isLegalBoardMove(item({ id: 'a', production_stage: 'approved' }), 'in_force', 'owner')).toBe(false)
    expect(isLegalBoardMove(submitted, 'issued', 'owner')).toBe(false)
  })

  it('rejects arbitrary column drops and terminal outgoing movement', () => {
    const submitted = item({ id: 'app-sub', production_stage: 'submitted' })
    expect(isLegalBoardMove(submitted, 'premium_drafted', 'owner')).toBe(false)
    expect(boardMoveDestinations(item({ id: 't', production_stage: 'in_force' }), 'owner')).toEqual([])
    expect(boardMoveDestinations(item({ id: 'w', production_stage: 'withdrawn' }), 'advisor')).toEqual([])
    expect(beginBoardMove(item({ id: 'd', production_stage: 'declined' }), 'submitted', 'owner').kind).toBe(
      'ignore',
    )
  })

  it('hides owner-only approved → in_underwriting from advisors and shows it to owners', () => {
    const approved = item({ id: 'app-appr', production_stage: 'approved' })
    expect(boardMoveDestinations(approved, 'advisor')).not.toContain('in_underwriting')
    expect(isLegalBoardMove(approved, 'in_underwriting', 'advisor')).toBe(false)
    expect(boardMoveDestinations(approved, 'owner')).toContain('in_underwriting')
    expect(isLegalBoardMove(approved, 'in_underwriting', 'owner')).toBe(true)
  })

  it('uses the same allowedNextStages helper for drag and Move to', () => {
    const row = item({
      id: 'app-1',
      production_stage: 'paramed',
      delivery_status: 'not_started',
    })
    const drag = boardMoveDestinations(row, 'advisor')
    const moveTo = allowedNextStages({
      from: row.production_stage,
      role: 'advisor',
      deletedAt: row.deleted_at,
      deliveryStatus: row.delivery_status,
    })
    expect(drag).toEqual(moveTo)
    expect(drag).toEqual(['in_underwriting', 'approved', 'declined', 'postponed', 'withdrawn', 'incomplete'])
  })

  it('calls the transition RPC for a legal drop and skips it for an illegal drop', async () => {
    const rpc = vi.fn()
    const submitted = item({ id: 'app-sub', production_stage: 'submitted' })
    const legal = await attemptBoardDrop({
      row: submitted,
      toStage: 'paramed',
      role: 'owner',
      rpc,
    })
    expect(legal.rpcCalled).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]?.[0]).toMatchObject({
      applicationId: 'app-sub',
      toStage: 'paramed',
    })

    rpc.mockClear()
    const illegal = await attemptBoardDrop({
      row: submitted,
      toStage: 'in_force',
      role: 'owner',
      rpc,
    })
    expect(illegal.rpcCalled).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('opens confirmation instead of RPC for issue, backward reason, and in-force', () => {
    expect(
      beginBoardMove(item({ id: 'a', production_stage: 'approved' }), 'issued', 'owner'),
    ).toMatchObject({
      kind: 'confirm',
      action: { needsPolicyNumber: true, confirmTitle: 'Issue this policy?' },
    })
    expect(
      beginBoardMove(
        item({ id: 'uw', production_stage: 'in_underwriting' }),
        'submitted',
        'owner',
      ),
    ).toMatchObject({
      kind: 'confirm',
      action: { needsReason: true },
    })
    expect(
      beginBoardMove(
        item({ id: 'i', production_stage: 'issued', delivery_status: 'complete' }),
        'in_force',
        'owner',
      ),
    ).toMatchObject({
      kind: 'confirm',
      action: { confirmTitle: 'Place this policy in force?' },
    })
    expect(
      isLegalBoardMove(
        item({ id: 'i', production_stage: 'issued', delivery_status: 'not_started' }),
        'in_force',
        'owner',
      ),
    ).toBe(false)
  })

  it('refetches on success or stale invalid_transition and restores on other failures', () => {
    expect(interpretBoardMoveResult(true, null, 'paramed')).toEqual({
      kind: 'success',
      refetch: true,
      restore: false,
      followStage: 'paramed',
      message: null,
    })
    const invalid = formatStageTransitionUserError({ message: 'CRM_PP:invalid_transition' })
    expect(interpretBoardMoveResult(false, invalid, 'paramed')).toEqual({
      kind: 'stale',
      refetch: true,
      restore: true,
      followStage: null,
      message: STALE_BOARD_REFRESH_MESSAGE,
    })
    const unauthorized = formatStageTransitionUserError({ message: 'CRM_PP:not_authorized' })
    expect(interpretBoardMoveResult(false, unauthorized, 'paramed')).toEqual({
      kind: 'error',
      refetch: false,
      restore: true,
      followStage: null,
      message: unauthorized,
    })
    expect(unauthorized).toBe('You do not have permission to change this stage.')
    expect(unauthorized).not.toMatch(/postgres|sqlstate|permission denied for table/i)
  })

  it('lets a filtered card disappear after the working set refreshes to a new stage', () => {
    const moved = item({ id: 'app-sub', production_stage: 'approved' })
    const visible = applyProductionQueueView([moved], {
      ...defaultProductionQueueFilters(),
      stages: ['submitted'],
    })
    expect(visible).toEqual([])
  })

  it('does not treat confirmation-gated hops as automatic RPC calls', async () => {
    const rpc = vi.fn()
    const issued = await attemptBoardDrop({
      row: item({ id: 'a', production_stage: 'approved' }),
      toStage: 'issued',
      role: 'owner',
      rpc,
    })
    expect(issued.rpcCalled).toBe(false)
    expect(issued.begin?.kind).toBe('confirm')
    if (issued.begin?.kind === 'confirm') {
      expect(boardMoveNeedsConfirmation(issued.begin.action)).toBe(true)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('uses board-origin wording for immediate board transitions and keeps user reasons', () => {
    const submitted = item({ id: 'app-sub', production_stage: 'submitted' })
    const action = beginBoardMove(submitted, 'paramed', 'owner')
    expect(action.kind).toBe('execute')
    if (action.kind !== 'execute') return
    expect(defaultBoardStageTransitionReason('paramed')).toBe('Updated from Production board — Paramed.')
    expect(defaultStageTransitionReason('paramed')).toBe('Updated from Production detail — Paramed.')
    expect(
      buildBoardTransitionRpcArgs(submitted, action.action, { reason: '', policyNumber: '' }).reason,
    ).toBe('Updated from Production board — Paramed.')
    expect(
      buildBoardTransitionRpcArgs(submitted, action.action, {
        reason: 'Advisor noted paramed required',
        policyNumber: '',
      }).reason,
    ).toBe('Advisor noted paramed required')
  })
})
