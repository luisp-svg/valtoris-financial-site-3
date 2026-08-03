/**
 * Authenticated Activity Engine writer.
 * Inserts into public.activities under RLS (owner or household access).
 * Does not use the service-role key.
 *
 * Activity Engine rows are operational timeline events — not audit_logs /
 * compliance before/after records. Use recordActivityBestEffort only when the
 * product contract allows the domain write to succeed without a timeline row.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getModule } from '../registry'
import { getActivityEventDefinition } from './eventCatalog'
import { buildActivityMetadata } from './metadata'
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

  const definition = getActivityEventDefinition(input.eventKey.trim())
  if (!definition) {
    return { ok: false, error: 'Unknown eventKey' }
  }

  if (!getModule(definition.moduleKey)) {
    return { ok: false, error: 'Event catalog moduleKey is not registered' }
  }

  if (input.moduleKey && input.moduleKey.trim() !== definition.moduleKey) {
    return { ok: false, error: 'moduleKey does not match event catalog module' }
  }

  if (!input.title || !input.title.trim()) {
    return { ok: false, error: 'title is required' }
  }
  if (input.title.trim().length > 240) {
    return { ok: false, error: 'title must be 240 characters or fewer' }
  }

  if (input.activityType && input.activityType !== definition.activityType) {
    return { ok: false, error: 'activityType does not match event catalog' }
  }

  for (const idKey of ['leadId', 'assessmentId', 'opportunityId', 'recommendationId', 'entityId', 'caseId'] as const) {
    const value = input[idKey]
    if (value == null || value === '') continue
    if (typeof value !== 'string' || !isUuid(value)) {
      return { ok: false, error: `${idKey} must be a valid UUID when provided` }
    }
  }

  return {
    ok: true,
    activityType: definition.activityType,
    moduleKey: definition.moduleKey,
  }
}

/**
 * Publish an activity through the Activity Engine.
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

  const metadata = buildActivityMetadata({
    ...input,
    eventKey: input.eventKey.trim(),
    moduleKey: validation.moduleKey,
  })

  // Supported columns only — never pass through arbitrary DB fields.
  const row: Record<string, unknown> = {
    household_id: input.householdId,
    activity_type: validation.activityType,
    title: input.title.trim(),
    body: input.body?.trim() ? input.body.trim() : null,
    metadata,
    lead_id: input.leadId ?? null,
    assessment_id: input.assessmentId ?? null,
    opportunity_id: input.opportunityId ?? null,
    recommendation_id: input.recommendationId ?? null,
  }

  if (input.occurredAt) {
    row.occurred_at = input.occurredAt
  }

  try {
    const { data, error } = await supabase.from('activities').insert(row).select('id').single()
    if (error) {
      return {
        ok: false,
        error: 'Unable to record activity',
        code: 'insert_failed',
      }
    }
    return { ok: true, id: String((data as { id: string }).id) }
  } catch {
    return {
      ok: false,
      error: 'Unable to record activity',
      code: 'unknown',
    }
  }
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
