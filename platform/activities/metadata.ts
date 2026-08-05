/**
 * Activity metadata build / parse helpers.
 * Publish path allow-lists metadata keys — never copy arbitrary caller bags.
 */

import { getActivityEventDefinition, inferEventKeyFromLegacyRow } from './eventCatalog'
import type {
  ActivityActorKind,
  ActivityEngineMetadata,
  ActivityVisibility,
  RecordActivityInput,
} from './types'

/**
 * Keys permitted when composing Activity Engine metadata for display/tests.
 * Browser writes for approved events go through record_crm_activity and use
 * the Migration 029 allowlists in recordCrmActivityRpc.ts instead.
 */
export const ACTIVITY_PUBLISH_METADATA_ALLOWLIST = [
  'taskId',
  'workflowType',
  'sourceType',
  'assessmentType',
  'documentId',
  'workflowRunId',
  'aiSummaryRef',
  /** Soft idempotency hint only — not a DB unique constraint. */
  'idempotencyKey',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

function pickAllowlistedExtras(raw: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of ACTIVITY_PUBLISH_METADATA_ALLOWLIST) {
    if (raw[key] === undefined) continue
    const value = raw[key]
    // Scalars / null only — never nested objects/arrays (PII risk).
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      picked[key] = value
    }
  }
  return picked
}

export function parseActivityMetadata(raw: unknown): ActivityEngineMetadata {
  return asRecord(raw) as ActivityEngineMetadata
}

export function resolveActorKind(input: {
  actorUserId: string | null | undefined
  metadata: ActivityEngineMetadata
}): ActivityActorKind {
  if (
    input.metadata.actorKind === 'user' ||
    input.metadata.actorKind === 'system' ||
    input.metadata.actorKind === 'automation' ||
    input.metadata.actorKind === 'ai'
  ) {
    return input.metadata.actorKind
  }
  if (!input.actorUserId) return 'system'
  return 'user'
}

export function resolveVisibility(metadata: ActivityEngineMetadata): ActivityVisibility {
  if (
    metadata.visibility === 'internal' ||
    metadata.visibility === 'client_visible' ||
    metadata.visibility === 'owner_only'
  ) {
    return metadata.visibility
  }
  return 'internal'
}

export function buildActivityMetadata(input: RecordActivityInput): ActivityEngineMetadata {
  const definition = getActivityEventDefinition(input.eventKey)
  const extras = pickAllowlistedExtras(asRecord(input.metadata))

  const metadata: ActivityEngineMetadata = {
    ...extras,
    eventKey: input.eventKey,
    module: input.moduleKey ?? definition?.moduleKey,
    entityType: input.entityType ?? definition?.defaultEntityType,
    entityId: input.entityId,
    caseId: input.caseId ?? null,
    visibility: input.visibility ?? 'internal',
    pinned: input.pinned === true,
    actorKind: input.actorKind ?? definition?.defaultActorKind ?? 'user',
  }

  for (const key of Object.keys(metadata)) {
    if (metadata[key] === undefined) delete metadata[key]
  }
  return metadata
}

export function enrichLegacyMetadata(input: {
  activityType: string
  title?: string | null
  metadata?: unknown
}): ActivityEngineMetadata {
  const base = parseActivityMetadata(input.metadata)
  const eventKey = inferEventKeyFromLegacyRow({
    activityType: input.activityType,
    title: input.title,
    metadata: base,
  })
  const definition = getActivityEventDefinition(eventKey)

  return {
    ...base,
    eventKey: typeof base.eventKey === 'string' && base.eventKey.trim() ? base.eventKey : eventKey,
    module:
      typeof base.module === 'string' && base.module.trim()
        ? base.module
        : definition?.moduleKey,
    actorKind: resolveActorKind({ actorUserId: null, metadata: base }),
    visibility: resolveVisibility(base),
    pinned: base.pinned === true,
    caseId: typeof base.caseId === 'string' ? base.caseId : null,
  }
}
