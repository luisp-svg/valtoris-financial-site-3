/**
 * Browser/authenticated client for Migration 029 record_crm_activity.
 *
 * Server derives activity_type, title, body, visibility, occurred_at, and actor.
 * Callers must not send those fields — only household, event key, allowlisted
 * metadata, and matching subject FKs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordActivityInput, RecordActivityResult } from './types'

export const RECORD_CRM_ACTIVITY_RPC_NAME = 'record_crm_activity' as const

export const RECORD_CRM_ACTIVITY_RPC_EVENT_KEYS = [
  'tasks.manual.created',
  'onboarding.completed',
] as const

/** Must match Migration 029 task event metadata allowlist. */
export const RECORD_CRM_ACTIVITY_TASK_METADATA_ALLOWLIST = [
  'taskId',
  'workflowType',
  'sourceType',
  'idempotencyKey',
] as const

/** Must match Migration 029 onboarding event metadata allowlist. */
export const RECORD_CRM_ACTIVITY_ONBOARDING_METADATA_ALLOWLIST = [
  'assessmentType',
  'idempotencyKey',
] as const

export type RecordCrmActivityRpcEventKey =
  (typeof RECORD_CRM_ACTIVITY_RPC_EVENT_KEYS)[number]

export type RecordCrmActivityRpcInput = {
  householdId: string
  eventKey: RecordCrmActivityRpcEventKey
  metadata?: Record<string, unknown> | null
  opportunityId?: string | null
  leadId?: string | null
  assessmentId?: string | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

function pickStringAllowlist(
  raw: Record<string, unknown>,
  allowlist: readonly string[],
): Record<string, string | null> {
  const picked: Record<string, string | null> = {}
  for (const key of allowlist) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (value === null) {
      picked[key] = null
      continue
    }
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  return picked
}

export function isRecordCrmActivityRpcEvent(
  eventKey: string,
): eventKey is RecordCrmActivityRpcEventKey {
  return (RECORD_CRM_ACTIVITY_RPC_EVENT_KEYS as readonly string[]).includes(eventKey)
}

/**
 * Map a legacy RecordActivityInput onto the RPC contract, dropping every
 * server-controlled field the browser must not send.
 */
export function toRecordCrmActivityRpcInput(
  input: RecordActivityInput,
):
  | { ok: true; value: RecordCrmActivityRpcInput }
  | { ok: false; error: string } {
  const eventKey = input.eventKey?.trim() ?? ''
  if (!isRecordCrmActivityRpcEvent(eventKey)) {
    return { ok: false, error: 'eventKey is not an approved record_crm_activity event' }
  }
  if (!input.householdId || !isUuid(input.householdId)) {
    return { ok: false, error: 'householdId must be a valid UUID' }
  }

  const rawMeta = asRecord(input.metadata)
  let metadata: Record<string, string | null>

  if (eventKey === 'tasks.manual.created') {
    metadata = pickStringAllowlist(rawMeta, RECORD_CRM_ACTIVITY_TASK_METADATA_ALLOWLIST)
    const taskId = metadata.taskId
    if (!taskId || !isUuid(taskId)) {
      return { ok: false, error: 'metadata.taskId must be a valid UUID' }
    }
    // Prefer explicit subject FKs; fall back only when they match the task row contract.
    for (const idKey of ['leadId', 'assessmentId', 'opportunityId'] as const) {
      const value = input[idKey]
      if (value == null || value === '') continue
      if (typeof value !== 'string' || !isUuid(value)) {
        return { ok: false, error: `${idKey} must be a valid UUID when provided` }
      }
    }
    return {
      ok: true,
      value: {
        householdId: input.householdId,
        eventKey,
        metadata,
        opportunityId: input.opportunityId ?? null,
        leadId: input.leadId ?? null,
        assessmentId: input.assessmentId ?? null,
      },
    }
  }

  // onboarding.completed
  metadata = pickStringAllowlist(rawMeta, RECORD_CRM_ACTIVITY_ONBOARDING_METADATA_ALLOWLIST)
  if (metadata.assessmentType !== 'household_onboarding') {
    return { ok: false, error: 'metadata.assessmentType must be household_onboarding' }
  }
  const assessmentId = input.assessmentId
  if (!assessmentId || !isUuid(assessmentId)) {
    return { ok: false, error: 'assessmentId must be a valid UUID' }
  }

  return {
    ok: true,
    value: {
      householdId: input.householdId,
      eventKey,
      metadata,
      opportunityId: null,
      leadId: null,
      assessmentId,
    },
  }
}

export async function recordCrmActivityRpc(
  supabase: SupabaseClient,
  input: RecordCrmActivityRpcInput,
): Promise<RecordActivityResult> {
  if (!isRecordCrmActivityRpcEvent(input.eventKey)) {
    return { ok: false, error: 'Unable to record activity', code: 'validation' }
  }
  if (!input.householdId || !isUuid(input.householdId)) {
    return { ok: false, error: 'Unable to record activity', code: 'validation' }
  }

  const allowlist =
    input.eventKey === 'tasks.manual.created'
      ? RECORD_CRM_ACTIVITY_TASK_METADATA_ALLOWLIST
      : RECORD_CRM_ACTIVITY_ONBOARDING_METADATA_ALLOWLIST
  const metadata = pickStringAllowlist(asRecord(input.metadata), allowlist)

  // Never forward server-controlled / spoofable fields even if present on input bags.
  for (const forbidden of [
    'activity_type',
    'title',
    'body',
    'occurred_at',
    'visibility',
    'created_by_user_id',
    'actorKind',
    'actor_user_id',
    'eventKey',
    'module',
    'entityType',
    'entityId',
    'caseId',
    'pinned',
  ]) {
    delete (metadata as Record<string, unknown>)[forbidden]
  }

  if (input.eventKey === 'tasks.manual.created') {
    if (!metadata.taskId || !isUuid(metadata.taskId)) {
      return { ok: false, error: 'Unable to record activity', code: 'validation' }
    }
  } else if (metadata.assessmentType !== 'household_onboarding') {
    return { ok: false, error: 'Unable to record activity', code: 'validation' }
  }

  const opportunityId =
    input.eventKey === 'onboarding.completed' ? null : (input.opportunityId ?? null)
  const leadId = input.eventKey === 'onboarding.completed' ? null : (input.leadId ?? null)
  const assessmentId =
    input.eventKey === 'onboarding.completed'
      ? (input.assessmentId ?? null)
      : (input.assessmentId ?? null)

  if (input.eventKey === 'onboarding.completed') {
    if (!assessmentId || !isUuid(assessmentId)) {
      return { ok: false, error: 'Unable to record activity', code: 'validation' }
    }
  }

  for (const id of [opportunityId, leadId, assessmentId]) {
    if (id == null || id === '') continue
    if (!isUuid(id)) {
      return { ok: false, error: 'Unable to record activity', code: 'validation' }
    }
  }

  try {
    const { data, error } = await supabase.rpc(RECORD_CRM_ACTIVITY_RPC_NAME, {
      p_household_id: input.householdId,
      p_event_key: input.eventKey,
      p_metadata: metadata,
      p_opportunity_id: opportunityId,
      p_lead_id: leadId,
      p_assessment_id: assessmentId,
    })

    if (error || data == null || data === '') {
      return {
        ok: false,
        error: 'Unable to record activity',
        code: 'rpc_failed',
      }
    }

    return { ok: true, id: String(data) }
  } catch {
    return {
      ok: false,
      error: 'Unable to record activity',
      code: 'rpc_failed',
    }
  }
}
