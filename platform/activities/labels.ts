/**
 * Human-readable labels for activity types and engine event keys.
 */

import { getActivityEventDefinition } from './eventCatalog'

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  lead_created: 'Lead created',
  assessment_completed: 'Assessment completed',
  stage_changed: 'Stage changed',
  assignment_changed: 'Assignment changed',
  recommendation_converted: 'Recommendation converted',
  task_created: 'Task created',
  task_completed: 'Task completed',
  note_added: 'Note added',
  system: 'System',
}

const EVENT_KEY_LABELS: Record<string, string> = {
  'crm.lead.created': 'Lead created',
  'diagnostic.ifd.submitted': 'Initial Financial Diagnostic',
  'crm.duplicate.resolved': 'Duplicate resolved',
  'tasks.automated.created': 'Follow-up task created',
  'tasks.manual.created': 'Task created',
  'tasks.completed': 'Task completed',
  'crm.household.stage_changed': 'Stage changed',
  'crm.opportunity.stage_changed': 'Opportunity stage changed',
  'crm.household.assigned': 'Assignment changed',
  'crm.recommendation.converted': 'Recommendation converted',
  'onboarding.completed': 'Onboarding completed',
  'notes.added': 'Note added',
}

export function formatActivityEventLabel(eventKey: string): string {
  if (EVENT_KEY_LABELS[eventKey]) return EVENT_KEY_LABELS[eventKey]
  const definition = getActivityEventDefinition(eventKey)
  if (definition) return definition.description
  if (eventKey.startsWith('legacy.')) {
    return formatActivityTypeLabel(eventKey.slice('legacy.'.length))
  }
  return eventKey.replace(/[._]/g, ' ')
}

export function formatActivityTypeLabel(activityType: string): string {
  if (ACTIVITY_TYPE_LABELS[activityType]) return ACTIVITY_TYPE_LABELS[activityType]
  return activityType.replace(/_/g, ' ')
}

/**
 * Prefer eventKey label when present in metadata; else activity_type.
 */
export function formatActivityLabel(input: {
  activityType: string
  eventKey?: string | null
  metadata?: Record<string, unknown> | null
}): string {
  const fromMeta =
    typeof input.metadata?.eventKey === 'string' ? input.metadata.eventKey : null
  const eventKey = input.eventKey ?? fromMeta
  if (eventKey) return formatActivityEventLabel(eventKey)
  return formatActivityTypeLabel(input.activityType)
}
