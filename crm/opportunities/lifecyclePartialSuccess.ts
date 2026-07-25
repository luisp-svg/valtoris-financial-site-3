import { OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE } from './opportunitiesApi'

/**
 * CRM-8.2B partial-success UI contract after move_opportunity_stage RPC commits
 * but the authoritative opportunity reload fails.
 *
 * Retry must bump reload only — never re-invoke the lifecycle RPC.
 */
export type LifecyclePartialSuccessUi = {
  lifecycleMode: null
  success: string
  reloadWarning: string
  /** Must remain false — Retry owns the reloadKey bump. */
  bumpReloadKey: false
}

export type LifecycleReloadRetryUi = {
  /** Increment workspace reloadKey only. */
  bumpReloadKey: true
  /** Warning stays until authoritative load succeeds. */
  clearReloadWarningImmediately: false
  /** Never call move_opportunity_stage from Retry. */
  callMoveOpportunityStage: false
}

export function buildLifecycleReloadFailureUi(
  message: string = OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE,
): LifecyclePartialSuccessUi {
  return {
    lifecycleMode: null,
    success: 'Stage updated successfully.',
    reloadWarning: message,
    bumpReloadKey: false,
  }
}

export function buildLifecycleReloadRetryUi(): LifecycleReloadRetryUi {
  return {
    bumpReloadKey: true,
    clearReloadWarningImmediately: false,
    callMoveOpportunityStage: false,
  }
}
