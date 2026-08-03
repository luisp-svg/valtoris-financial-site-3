/** Human labels for activity types — backed by the Activity Engine. */
import { formatActivityTypeLabel as formatPlatformActivityTypeLabel } from '../../platform/activities'

export function formatActivityTypeLabel(activityType: string): string {
  return formatPlatformActivityTypeLabel(activityType)
}
