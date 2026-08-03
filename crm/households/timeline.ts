import {
  enrichHouseholdActivityMetadata,
  mapActivityToTimelinePresentation,
  normalizeHouseholdActivityRecord,
} from '../../platform/activities'
import type {
  HouseholdActivityRecord,
  HouseholdNote,
  HouseholdTimelineDisplayVariant,
  HouseholdTimelineItem,
} from './types'

export function noteTimelineId(noteId: string): string {
  return `note:${noteId}`
}

export function activityTimelineId(activityId: string): string {
  return `activity:${activityId}`
}

export function isNoteEdited(createdAt: string, updatedAt: string): boolean {
  const created = Date.parse(createdAt)
  const updated = Date.parse(updatedAt)
  if (Number.isNaN(created) || Number.isNaN(updated)) return false
  return updated > created
}

/**
 * Map engine display variants onto existing CRM CSS variants (no visual redesign).
 */
function toCrmDisplayVariant(
  variant: ReturnType<typeof mapActivityToTimelinePresentation>['displayVariant'],
): HouseholdTimelineDisplayVariant {
  if (variant === 'diagnostic') return 'system'
  return variant
}

export function normalizeNoteToTimelineItem(note: HouseholdNote): HouseholdTimelineItem {
  return {
    id: noteTimelineId(note.id),
    householdId: note.household_id,
    activityType: 'note',
    displayVariant: 'note',
    title: 'Note',
    body: note.body,
    actorUserId: note.author_user_id,
    actorDisplayName: note.author_display_name,
    occurredAt: note.created_at,
    updatedAt: note.updated_at,
    sourceEntityType: 'note',
    sourceEntityId: note.id,
    isEditable: true,
    isDeletable: true,
    isEdited: isNoteEdited(note.created_at, note.updated_at),
  }
}

export function normalizeActivityToTimelineItem(
  activity: HouseholdActivityRecord,
): HouseholdTimelineItem {
  const platform = normalizeHouseholdActivityRecord(activity)
  const presentation = mapActivityToTimelinePresentation(platform)
  const enrichedMetadata = enrichHouseholdActivityMetadata(activity)

  return {
    id: activityTimelineId(activity.id),
    householdId: activity.household_id,
    activityType: presentation.timelineActivityType,
    displayVariant: toCrmDisplayVariant(presentation.displayVariant),
    title: activity.title || 'Activity',
    body: activity.body,
    actorUserId: activity.actor_user_id,
    actorDisplayName: activity.actor_display_name,
    occurredAt: activity.occurred_at,
    updatedAt: null,
    sourceEntityType: 'activity',
    sourceEntityId: activity.id,
    isEditable: false,
    isDeletable: false,
    isEdited: false,
    metadata: enrichedMetadata,
  }
}

/** Merge notes + activities and sort by occurredAt descending (stable by id). */
export function buildHouseholdTimeline(
  notes: HouseholdNote[],
  activities: HouseholdActivityRecord[],
): HouseholdTimelineItem[] {
  const items: HouseholdTimelineItem[] = [
    ...notes.map(normalizeNoteToTimelineItem),
    ...activities.map(normalizeActivityToTimelineItem),
  ]

  return items.sort((a, b) => {
    const byTime = b.occurredAt.localeCompare(a.occurredAt)
    if (byTime !== 0) return byTime
    return b.id.localeCompare(a.id)
  })
}
