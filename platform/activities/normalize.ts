/**
 * Normalize DB activity rows into the Platform Activity read model.
 */

import { getActivityEventDefinition, inferEventKeyFromLegacyRow } from './eventCatalog'
import {
  parseActivityMetadata,
  resolveActorKind,
  resolveVisibility,
} from './metadata'
import type {
  ActivityEntityType,
  ActivityRowInput,
  PlatformActivity,
} from './types'

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function normalizeActivityRow(row: ActivityRowInput): PlatformActivity {
  const metadata = parseActivityMetadata(row.metadata)
  const eventKey =
    typeof metadata.eventKey === 'string' && metadata.eventKey.trim()
      ? metadata.eventKey.trim()
      : inferEventKeyFromLegacyRow({
          activityType: row.activity_type,
          title: row.title,
          metadata,
        })
  const definition = getActivityEventDefinition(eventKey)
  const actorUserId = row.actor_user_id ?? null

  const entityType =
    (typeof metadata.entityType === 'string'
      ? (metadata.entityType as ActivityEntityType)
      : null) ??
    definition?.defaultEntityType ??
    null

  const entityId =
    readOptionalString(metadata.entityId) ??
    row.assessment_id ??
    row.lead_id ??
    row.opportunity_id ??
    row.recommendation_id ??
    null

  return {
    id: String(row.id),
    householdId: String(row.household_id),
    activityType: String(row.activity_type),
    eventKey,
    moduleKey:
      (typeof metadata.module === 'string' && metadata.module.trim()
        ? metadata.module.trim()
        : null) ??
      definition?.moduleKey ??
      null,
    title: String(row.title ?? ''),
    body: row.body ?? null,
    actorUserId,
    actorDisplayName: row.actor_display_name ?? null,
    actorKind: resolveActorKind({ actorUserId, metadata }),
    visibility: resolveVisibility(metadata),
    pinned: metadata.pinned === true,
    entityType,
    entityId,
    caseId: readOptionalString(metadata.caseId) ?? null,
    leadId: row.lead_id ?? null,
    assessmentId: row.assessment_id ?? null,
    opportunityId: row.opportunity_id ?? null,
    recommendationId: row.recommendation_id ?? null,
    metadata: {
      ...metadata,
      eventKey,
      module: metadata.module ?? definition?.moduleKey,
      actorKind: resolveActorKind({ actorUserId, metadata }),
      visibility: resolveVisibility(metadata),
      pinned: metadata.pinned === true,
      caseId: readOptionalString(metadata.caseId) ?? null,
    },
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at ?? row.occurred_at),
  }
}

/**
 * Adapter for existing HouseholdActivityRecord-shaped objects.
 */
export function normalizeHouseholdActivityRecord(record: {
  id: string
  household_id: string
  actor_user_id: string | null
  actor_display_name: string | null
  activity_type: string
  title: string
  body: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}): PlatformActivity {
  return normalizeActivityRow({
    id: record.id,
    household_id: record.household_id,
    actor_user_id: record.actor_user_id,
    actor_display_name: record.actor_display_name,
    activity_type: record.activity_type,
    title: record.title,
    body: record.body,
    metadata: record.metadata,
    occurred_at: record.occurred_at,
    created_at: record.created_at,
  })
}
