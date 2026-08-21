/**
 * Post-placement policy lifecycle writes.
 * Writes: Migration 045 record_policy_post_placement_outcome only.
 * Never table INSERT/UPDATE/DELETE. Never commission, expected, or opportunity RPCs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatPolicyLifecycleUserError,
  policyLifecycleErrorCode,
} from './policyLifecycleErrors'
import type { PostPlacementRpcArgs } from './policyLifecycleView'

export const POLICY_LIFECYCLE_RPC = 'record_policy_post_placement_outcome' as const

export const APPROVED_POLICY_LIFECYCLE_RPCS = [POLICY_LIFECYCLE_RPC] as const

export type PolicyLifecycleWriteSuccess = {
  ok: true
  applicationId: string
  policyId: string
  status: string
}

export type PolicyLifecycleWriteFailure = {
  ok: false
  code: string | null
  message: string
}

export type PolicyLifecycleWriteResult = PolicyLifecycleWriteSuccess | PolicyLifecycleWriteFailure

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function recordPostPlacementOutcomeRpcArgs(input: PostPlacementRpcArgs): PostPlacementRpcArgs {
  return {
    p_application_id: input.p_application_id,
    p_status: input.p_status,
    p_reason: input.p_reason,
    p_terminated_on: input.p_terminated_on,
  }
}

export async function recordPolicyPostPlacementOutcome(
  supabase: SupabaseClient,
  input: PostPlacementRpcArgs,
): Promise<PolicyLifecycleWriteResult> {
  const { data, error } = await supabase.rpc(
    POLICY_LIFECYCLE_RPC,
    recordPostPlacementOutcomeRpcArgs(input),
  )
  if (error) {
    return {
      ok: false,
      code: policyLifecycleErrorCode(error),
      message: formatPolicyLifecycleUserError(error),
    }
  }
  const row = asRecord(data)
  if (!row || row.ok !== true) {
    return {
      ok: false,
      code: null,
      message: formatPolicyLifecycleUserError(error),
    }
  }
  return {
    ok: true,
    applicationId: typeof row.application_id === 'string' ? row.application_id : input.p_application_id,
    policyId: typeof row.policy_id === 'string' ? row.policy_id : '',
    status: typeof row.status === 'string' ? row.status : input.p_status,
  }
}
