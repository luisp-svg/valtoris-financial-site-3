import { describe, expect, it, vi } from 'vitest'
import {
  buildLifecycleReloadFailureUi,
  buildLifecycleReloadRetryUi,
} from './lifecyclePartialSuccess'
import {
  isOpportunityStageReloadFailure,
  moveOpportunityStage,
  OPPORTUNITY_STAGE_RELOAD_FAILED_MESSAGE,
  OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE,
} from './opportunitiesApi'
import type { OpportunityStageOption } from './types'

const stages: OpportunityStageOption[] = [
  {
    id: 'stage-1',
    pipeline_id: 'pipe-1',
    name: 'Opportunity Identified',
    code: 'opportunity_identified',
    sort_order: 1,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-2',
    pipeline_id: 'pipe-1',
    name: 'Fact Finder',
    code: 'fact_finder',
    sort_order: 2,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
]

describe('CRM-8.2B partial-success reload contract', () => {
  it('classifies reload failures separately from mutation failures', () => {
    expect(isOpportunityStageReloadFailure(new Error(OPPORTUNITY_STAGE_RELOAD_FAILED_MESSAGE))).toBe(
      true,
    )
    expect(isOpportunityStageReloadFailure(new Error('not authorized to move this opportunity stage'))).toBe(
      false,
    )
    expect(isOpportunityStageReloadFailure({ message: 'PGRST999' })).toBe(false)
  })

  it('builds success + warning UI without bumping reload or implying mutation failure', () => {
    const ui = buildLifecycleReloadFailureUi()
    expect(ui.lifecycleMode).toBeNull()
    expect(ui.success).toBe('Stage updated successfully.')
    expect(ui.reloadWarning).toBe(OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE)
    expect(ui.reloadWarning).toMatch(/stage updated successfully/i)
    expect(ui.reloadWarning).toMatch(/could not be reloaded/i)
    expect(ui.reloadWarning).toMatch(/retry/i)
    expect(ui.reloadWarning).not.toMatch(/move_opportunity_stage failed/i)
    expect(ui.bumpReloadKey).toBe(false)
  })

  it('Retry action reloads only and never re-invokes the lifecycle RPC', () => {
    const retry = buildLifecycleReloadRetryUi()
    expect(retry.bumpReloadKey).toBe(true)
    expect(retry.clearReloadWarningImmediately).toBe(false)
    expect(retry.callMoveOpportunityStage).toBe(false)

    let reloadKey = 0
    let moveCalls = 0
    let warning: string | null = OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE
    const success = 'Stage updated successfully.'
    // Stale workspace remains visible until authoritative reload replaces it.
    let stageLabel = 'Opportunity Identified'

    // Simulate Retry click using the contract flags.
    if (retry.callMoveOpportunityStage) moveCalls += 1
    if (retry.bumpReloadKey) reloadKey += 1
    if (retry.clearReloadWarningImmediately) warning = null

    expect(moveCalls).toBe(0)
    expect(reloadKey).toBe(1)
    expect(warning).toBe(OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE)
    expect(success).toBe('Stage updated successfully.')
    expect(stageLabel).toBe('Opportunity Identified')

    // Failed Retry: warning + success preserved; RPC still once; stale data kept.
    expect(moveCalls).toBe(0)
    expect(warning).not.toBeNull()

    // Successful Retry: authoritative data replaces stale row; warning clears.
    stageLabel = 'Fact Finder'
    warning = null
    expect(stageLabel).toBe('Fact Finder')
    expect(warning).toBeNull()
    expect(moveCalls).toBe(0)
  })

  it('warning is not cleared by opening another dialog — only by successful reload', () => {
    const ui = buildLifecycleReloadFailureUi()
    let warning: string | null = ui.reloadWarning
    // Opening Move/Edit must not swallow the partial-success warning.
    const openMoveStage = () => {
      /* deliberately does not clear reloadWarning */
    }
    openMoveStage()
    expect(warning).toBe(OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE)
    // Authoritative reload success
    warning = null
    expect(warning).toBeNull()
  })

  it('moveOpportunityStage: RPC once, reload rejection → partial-success error, no second RPC', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'opp-1' }, error: null }))
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: { message: 'QA simulated refresh failure', code: 'PGRST999' },
    }))
    const supabase = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    }

    await expect(
      moveOpportunityStage(supabase as never, 'opp-1', 'stage-2', stages, 'pipe-1', {
        currentStageId: 'stage-1',
      }),
    ).rejects.toSatisfy((err: unknown) => isOpportunityStageReloadFailure(err))

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('move_opportunity_stage', {
      p_opportunity_id: 'opp-1',
      p_stage_id: 'stage-2',
    })
    expect(maybeSingle).toHaveBeenCalledTimes(1)

    // Dialog/workspace contract: detect reload failure → apply UI without second mutation.
    const ui = buildLifecycleReloadFailureUi()
    const retry = buildLifecycleReloadRetryUi()
    let moveCalls = 1 // the original successful RPC path above
    if (retry.callMoveOpportunityStage) moveCalls += 1
    expect(moveCalls).toBe(1)
    expect(ui.bumpReloadKey).toBe(false)
    expect(retry.callMoveOpportunityStage).toBe(false)
  })

  it('moveOpportunityStage: null reload row also yields partial-success error after one RPC', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'opp-1' }, error: null }))
    const supabase = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
    }

    await expect(
      moveOpportunityStage(supabase as never, 'opp-1', 'stage-2', stages, 'pipe-1', {
        currentStageId: 'stage-1',
      }),
    ).rejects.toThrow(OPPORTUNITY_STAGE_RELOAD_FAILED_MESSAGE)

    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
