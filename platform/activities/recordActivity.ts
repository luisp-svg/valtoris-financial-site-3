/**
 * Authenticated Activity Engine writer (browser).
 *
 * Only Migration 029 RPC events are supported:
 *   - tasks.manual.created
 *   - onboarding.completed
 *
 * Both call record_crm_activity. Server derives type/title/visibility/actor/time.
 * There is no browser direct INSERT into public.activities.
 *
 * Does not use the service-role key.
 *
 * Use recordActivityBestEffort only when the product contract allows the domain
 * write to succeed without a timeline row.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getModule } from '../registry'
import { getActivityEventDefinition } from './eventCatalog'
import {
  isRecordCrmActivityRpcEvent,
  recordCrmActivityRpc,
  toRecordCrmActivityRpcInput,
} from './recordCrmActivityRpc'
import type { RecordActivityInput, RecordActivityResult } from './types'

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function isDevRuntime(): boolean {
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
  }
}

export function validateRecordActivityInput(
  input: RecordActivityInput,
): { ok: true; activityType: string; moduleKey: string } | { ok: false; error: string } {
  if (!input.householdId || !isUuid(input.householdId)) {
    return { ok: false, error: 'householdId must be a valid UUID' }
  }
  if (!input.eventKey || !input.eventKey.trim()) {
    return { ok: false, error: 'eventKey is required' }
  }

  const eventKey = input.eventKey.trim()
  if (!isRecordCrmActivityRpcEvent(eventKey)) {
    return {
      ok: false,
      error: 'eventKey is not an approved browser record_crm_activity event',
    }
  }

  const definition = getActivityEventDefinition(eventKey)
  if (!definition) {
    return { ok: false, error: 'Unknown eventKey' }
  }

  if (!getModule(definition.moduleKey)) {
    return { ok: false, error: 'Event catalog moduleKey is not registered' }
  }

  if (input.moduleKey && input.moduleKey.trim() !== definition.moduleKey) {
    return { ok: false, error: 'moduleKey does not match event catalog module' }
  }

  const mapped = toRecordCrmActivityRpcInput(input)
  if (!mapped.ok) return { ok: false, error: mapped.error }

  return {
    ok: true,
    activityType: definition.activityType,
    moduleKey: definition.moduleKey,
  }
}

/**
 * Publish an approved browser activity through record_crm_activity.
 * Call only after the domain write succeeds when using best-effort wrappers.
 */
export async function recordActivity(
  supabase: SupabaseClient,
  input: RecordActivityInput,
): Promise<RecordActivityResult> {
  const validation = validateRecordActivityInput(input)
  if (!validation.ok) {
    return { ok: false, error: validation.error, code: 'validation' }
  }

  const mapped = toRecordCrmActivityRpcInput(input)
  if (!mapped.ok) {
    return { ok: false, error: mapped.error, code: 'validation' }
  }
  return recordCrmActivityRpc(supabase, mapped.value)
}

/**
 * Best-effort timeline publish.
 *
 * Failure is non-blocking and must never undo or mutate the prior domain result.
 * This is NOT a compliance/audit write path — do not use for required audit_logs.
 * Logs only safe identifiers in development (eventKey + error code).
 */
export async function recordActivityBestEffort(
  supabase: SupabaseClient,
  input: RecordActivityInput,
): Promise<RecordActivityResult> {
  try {
    const result = await recordActivity(supabase, input)
    if (!result.ok && isDevRuntime()) {
      console.error('[activity-engine] best-effort publish failed', {
        eventKey: input.eventKey,
        code: result.code,
      })
    }
    return result
  } catch {
    if (isDevRuntime()) {
      console.error('[activity-engine] best-effort publish threw', {
        eventKey: input.eventKey,
        code: 'unknown',
      })
    }
    return { ok: false, error: 'Unable to record activity', code: 'unknown' }
  }
}
