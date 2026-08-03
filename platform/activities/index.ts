/**
 * Platform Activity Engine — public API.
 */

export type {
  ActivityActorKind,
  ActivityEngineMetadata,
  ActivityEntityType,
  ActivityEventKey,
  ActivityRowInput,
  ActivityTimelineMapping,
  ActivityVisibility,
  PlatformActivity,
  RecordActivityInput,
  RecordActivityResult,
  TimelineDisplayVariant,
} from './types'

export {
  ACTIVITY_EVENT_DEFINITIONS,
  getActivityEventDefinition,
  inferEventKeyFromLegacyRow,
  listActivityEventKeysFromCatalog,
  resolveTimelineMapping,
} from './eventCatalog'

export {
  ACTIVITY_PUBLISH_METADATA_ALLOWLIST,
  buildActivityMetadata,
  enrichLegacyMetadata,
  parseActivityMetadata,
  resolveActorKind,
  resolveVisibility,
} from './metadata'

export {
  normalizeActivityRow,
  normalizeHouseholdActivityRecord,
} from './normalize'

export {
  recordActivity,
  recordActivityBestEffort,
  validateRecordActivityInput,
} from './recordActivity'

export {
  enrichHouseholdActivityMetadata,
  filterPlatformActivities,
  mapActivityToTimelinePresentation,
  sortActivitiesByOccurredAtDesc,
  type ActivityTimelineFilter,
} from './timeline'

export {
  formatActivityEventLabel,
  formatActivityLabel,
  formatActivityTypeLabel,
} from './labels'
