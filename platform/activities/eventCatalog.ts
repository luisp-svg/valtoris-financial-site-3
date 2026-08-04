/**
 * Event catalog: eventKey → DB activity_type + defaults.
 * Maps legacy SQL writers into the universal eventKey namespace.
 */

import type {
  ActivityActorKind,
  ActivityEntityType,
  ActivityEventKey,
  ActivityTimelineMapping,
} from './types'

export type ActivityEventDefinition = {
  eventKey: ActivityEventKey
  /** Closest public.activity_type enum value. */
  activityType: string
  moduleKey: string
  defaultEntityType?: ActivityEntityType
  defaultActorKind?: ActivityActorKind
  description: string
  timeline: ActivityTimelineMapping
}

export const ACTIVITY_EVENT_DEFINITIONS: readonly ActivityEventDefinition[] = [
  {
    eventKey: 'crm.lead.created',
    activityType: 'lead_created',
    moduleKey: 'intake',
    defaultEntityType: 'lead',
    defaultActorKind: 'system',
    description: 'Lead created (public or CRM)',
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'diagnostic.ifd.submitted',
    activityType: 'assessment_completed',
    moduleKey: 'initial_financial_diagnostic',
    defaultEntityType: 'assessment',
    defaultActorKind: 'system',
    description: 'Initial Financial Diagnostic submitted',
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'crm.duplicate.resolved',
    activityType: 'system',
    moduleKey: 'intake',
    defaultEntityType: 'lead',
    defaultActorKind: 'user',
    description: 'Public Family duplicate review resolved',
    timeline: { timelineActivityType: 'other', displayVariant: 'system' },
  },
  {
    eventKey: 'tasks.automated.created',
    activityType: 'system',
    moduleKey: 'tasks',
    defaultEntityType: 'task',
    defaultActorKind: 'automation',
    description: 'Automated Family follow-up task created',
    timeline: { timelineActivityType: 'task_created', displayVariant: 'task' },
  },
  {
    eventKey: 'tasks.manual.created',
    activityType: 'task_created',
    moduleKey: 'tasks',
    defaultEntityType: 'task',
    defaultActorKind: 'user',
    description: 'Manual task created',
    timeline: { timelineActivityType: 'task_created', displayVariant: 'task' },
  },
  {
    eventKey: 'tasks.completed',
    activityType: 'task_completed',
    moduleKey: 'tasks',
    defaultEntityType: 'task',
    defaultActorKind: 'user',
    description: 'Task completed',
    timeline: { timelineActivityType: 'task_completed', displayVariant: 'task' },
  },
  {
    eventKey: 'crm.household.stage_changed',
    activityType: 'stage_changed',
    moduleKey: 'households',
    defaultEntityType: 'household',
    defaultActorKind: 'user',
    description: 'Household relationship stage changed',
    timeline: { timelineActivityType: 'stage_changed', displayVariant: 'stage' },
  },
  {
    eventKey: 'crm.opportunity.stage_changed',
    activityType: 'stage_changed',
    moduleKey: 'pipeline',
    defaultEntityType: 'opportunity',
    defaultActorKind: 'user',
    description: 'Opportunity stage changed',
    timeline: { timelineActivityType: 'stage_changed', displayVariant: 'stage' },
  },
  {
    eventKey: 'crm.household.assigned',
    activityType: 'assignment_changed',
    moduleKey: 'households',
    defaultEntityType: 'household',
    defaultActorKind: 'user',
    description: 'Household assignment changed',
    timeline: { timelineActivityType: 'assignment_changed', displayVariant: 'assignment' },
  },
  {
    eventKey: 'crm.recommendation.converted',
    activityType: 'recommendation_converted',
    moduleKey: 'pipeline',
    defaultEntityType: 'recommendation',
    defaultActorKind: 'user',
    description: 'Recommendation converted to opportunity',
    timeline: {
      timelineActivityType: 'recommendation_converted',
      displayVariant: 'recommendation',
    },
  },
  {
    eventKey: 'onboarding.completed',
    activityType: 'assessment_completed',
    moduleKey: 'households',
    defaultEntityType: 'assessment',
    defaultActorKind: 'user',
    description: 'Household Onboarding completed',
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'notes.added',
    activityType: 'note_added',
    moduleKey: 'households',
    defaultEntityType: 'note',
    defaultActorKind: 'user',
    description: 'Note added (optional activity mirror; notes table remains source of truth)',
    timeline: { timelineActivityType: 'note', displayVariant: 'note' },
  },
  {
    eventKey: 'digital_identity.lead_created',
    activityType: 'lead_created',
    moduleKey: 'digital_identity',
    defaultEntityType: 'lead',
    defaultActorKind: 'system',
    description: "Digital Identity / Let's Connect lead created",
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'digital_identity.lead_matched',
    activityType: 'lead_created',
    moduleKey: 'digital_identity',
    defaultEntityType: 'lead',
    defaultActorKind: 'system',
    description: 'Digital Identity lead matched existing household',
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'digital_identity.lead_possible_match',
    activityType: 'lead_created',
    moduleKey: 'digital_identity',
    defaultEntityType: 'lead',
    defaultActorKind: 'system',
    description: 'Digital Identity lead flagged as possible duplicate',
    timeline: { timelineActivityType: 'other', displayVariant: 'diagnostic' },
  },
  {
    eventKey: 'digital_identity.contact_shared',
    activityType: 'system',
    moduleKey: 'digital_identity',
    defaultEntityType: 'lead',
    defaultActorKind: 'system',
    description: "Visitor completed Let's Connect relationship capture",
    timeline: { timelineActivityType: 'other', displayVariant: 'system' },
  },
  {
    eventKey: 'digital_identity.duplicate_resolved',
    activityType: 'system',
    moduleKey: 'digital_identity',
    defaultEntityType: 'lead',
    defaultActorKind: 'user',
    description: 'Digital Identity duplicate review resolved',
    timeline: { timelineActivityType: 'other', displayVariant: 'system' },
  },
] as const

const BY_EVENT_KEY = new Map(
  ACTIVITY_EVENT_DEFINITIONS.map((definition) => [definition.eventKey, definition]),
)

export function getActivityEventDefinition(
  eventKey: string,
): ActivityEventDefinition | undefined {
  return BY_EVENT_KEY.get(eventKey)
}

export function listActivityEventKeysFromCatalog(): string[] {
  return ACTIVITY_EVENT_DEFINITIONS.map((definition) => definition.eventKey).sort()
}

/**
 * Infer eventKey from legacy DB rows that predate Activity Engine metadata.
 */
export function inferEventKeyFromLegacyRow(input: {
  activityType: string
  title?: string | null
  metadata?: Record<string, unknown>
}): string {
  const meta = input.metadata ?? {}
  if (typeof meta.eventKey === 'string' && meta.eventKey.trim()) {
    return meta.eventKey.trim()
  }

  const legacyEvent = typeof meta.event === 'string' ? meta.event : ''
  if (
    legacyEvent === 'public_duplicate_confirmed' ||
    legacyEvent === 'public_duplicate_kept_separate'
  ) {
    return 'crm.duplicate.resolved'
  }
  if (legacyEvent === 'public_family_follow_up_task_created') {
    return 'tasks.automated.created'
  }
  if (
    legacyEvent === 'digital_identity.lead_created' ||
    legacyEvent === 'digital_identity.lead_matched' ||
    legacyEvent === 'digital_identity.lead_possible_match' ||
    legacyEvent === 'digital_identity.contact_shared' ||
    legacyEvent === 'digital_identity.duplicate_resolved'
  ) {
    return legacyEvent
  }

  switch (input.activityType) {
    case 'lead_created':
      return 'crm.lead.created'
    case 'assessment_completed': {
      const channel = meta.capture_channel ?? meta.captureChannel
      if (channel === 'public_self_report') return 'diagnostic.ifd.submitted'
      const title = (input.title ?? '').toLowerCase()
      if (title.includes('onboarding')) return 'onboarding.completed'
      if (title.includes('initial financial diagnostic') || title.includes('report card')) {
        return 'diagnostic.ifd.submitted'
      }
      return 'diagnostic.ifd.submitted'
    }
    case 'assignment_changed':
      return 'crm.household.assigned'
    case 'stage_changed':
      return meta.opportunity_id || meta.opportunityId
        ? 'crm.opportunity.stage_changed'
        : 'crm.household.stage_changed'
    case 'recommendation_converted':
      return 'crm.recommendation.converted'
    case 'task_created':
      return 'tasks.manual.created'
    case 'task_completed':
      return 'tasks.completed'
    case 'note_added':
      return 'notes.added'
    case 'system':
      return 'crm.duplicate.resolved'
    default:
      return `legacy.${input.activityType}`
  }
}

export function resolveTimelineMapping(
  activityType: string,
  eventKey: string,
): ActivityTimelineMapping {
  const fromCatalog = getActivityEventDefinition(eventKey)?.timeline
  if (fromCatalog) return fromCatalog

  switch (activityType) {
    case 'assignment_changed':
      return { timelineActivityType: 'assignment_changed', displayVariant: 'assignment' }
    case 'stage_changed':
      return { timelineActivityType: 'stage_changed', displayVariant: 'stage' }
    case 'recommendation_converted':
      return {
        timelineActivityType: 'recommendation_converted',
        displayVariant: 'recommendation',
      }
    case 'recommendation_created':
    case 'recommendation_reviewed':
      return { timelineActivityType: 'other', displayVariant: 'recommendation' }
    case 'task_created':
      return { timelineActivityType: 'task_created', displayVariant: 'task' }
    case 'task_completed':
      return { timelineActivityType: 'task_completed', displayVariant: 'task' }
    case 'note_added':
      return { timelineActivityType: 'note', displayVariant: 'note' }
    default:
      return { timelineActivityType: 'other', displayVariant: 'system' }
  }
}
