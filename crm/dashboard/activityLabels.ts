/** Human labels for activity types that are actually written today. */
export function formatActivityTypeLabel(activityType: string): string {
  switch (activityType) {
    case 'stage_changed':
      return 'Stage changed'
    case 'assignment_changed':
      return 'Assignment changed'
    case 'recommendation_converted':
      return 'Recommendation converted'
    default:
      return activityType.replace(/_/g, ' ')
  }
}
