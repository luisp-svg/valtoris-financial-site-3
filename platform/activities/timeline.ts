/**
 * Timeline helpers for the Activity Engine.
 * Household UI keeps merging notes separately; these helpers sort/filter activities.
 */

import { resolveTimelineMapping } from './eventCatalog'
import { normalizeHouseholdActivityRecord } from './normalize'
import type { PlatformActivity, TimelineDisplayVariant } from './types'

export type ActivityTimelineFilter = {
  moduleKey?: string
  eventKey?: string
  entityType?: string
  pinnedOnly?: boolean
  visibility?: PlatformActivity['visibility']
}

export function sortActivitiesByOccurredAtDesc(
  activities: PlatformActivity[],
): PlatformActivity[] {
  return activities.slice().sort((a, b) => {
    const byTime = b.occurredAt.localeCompare(a.occurredAt)
    if (byTime !== 0) return byTime
    return b.id.localeCompare(a.id)
  })
}

export function filterPlatformActivities(
  activities: PlatformActivity[],
  filter: ActivityTimelineFilter = {},
): PlatformActivity[] {
  return activities.filter((activity) => {
    if (filter.moduleKey && activity.moduleKey !== filter.moduleKey) return false
    if (filter.eventKey && activity.eventKey !== filter.eventKey) return false
    if (filter.entityType && activity.entityType !== filter.entityType) return false
    if (filter.pinnedOnly && !activity.pinned) return false
    if (filter.visibility && activity.visibility !== filter.visibility) return false
    return true
  })
}

export function mapActivityToTimelinePresentation(activity: PlatformActivity): {
  timelineActivityType: ReturnType<typeof resolveTimelineMapping>['timelineActivityType']
  displayVariant: TimelineDisplayVariant
  eventKey: string
  moduleKey: string | null
  pinned: boolean
  visibility: PlatformActivity['visibility']
  metadata: PlatformActivity['metadata']
} {
  const mapping = resolveTimelineMapping(activity.activityType, activity.eventKey)
  return {
    timelineActivityType: mapping.timelineActivityType,
    displayVariant: mapping.displayVariant,
    eventKey: activity.eventKey,
    moduleKey: activity.moduleKey,
    pinned: activity.pinned,
    visibility: activity.visibility,
    metadata: activity.metadata,
  }
}

/**
 * Enrich a household activity record's metadata with engine fields (non-destructive).
 * Used by the CRM timeline adapter for consistent eventKey/module/visibility.
 */
export function enrichHouseholdActivityMetadata(record: {
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
}): Record<string, unknown> {
  const platform = normalizeHouseholdActivityRecord(record)
  return {
    ...record.metadata,
    eventKey: platform.eventKey,
    module: platform.moduleKey,
    actorKind: platform.actorKind,
    visibility: platform.visibility,
    pinned: platform.pinned,
    caseId: platform.caseId,
    entityType: platform.entityType,
    entityId: platform.entityId,
  }
}
