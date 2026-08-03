/**
 * Activity Engine types — Platform Constitution (Sprint 4B.3).
 * Reuses public.activities; extends via metadata conventions until indexed columns are needed.
 */

export type ActivityActorKind = 'user' | 'system' | 'automation' | 'ai'

export type ActivityVisibility = 'internal' | 'client_visible' | 'owner_only'

/**
 * Logical entity linkage (metadata + optional FK columns on activities).
 * `case` is reserved for the future Case Engine.
 */
export type ActivityEntityType =
  | 'household'
  | 'business'
  | 'lead'
  | 'assessment'
  | 'task'
  | 'document'
  | 'opportunity'
  | 'recommendation'
  | 'note'
  | 'policy'
  | 'appointment'
  | 'case'
  | 'other'

/** Canonical dotted event keys (Module Registry aligned). */
export type ActivityEventKey = string

/**
 * Standard metadata bag stored in activities.metadata.
 * Unknown keys are preserved for backward compatibility.
 */
export type ActivityEngineMetadata = {
  eventKey?: ActivityEventKey
  module?: string
  entityType?: ActivityEntityType
  entityId?: string
  caseId?: string | null
  visibility?: ActivityVisibility
  pinned?: boolean
  actorKind?: ActivityActorKind
  /** Legacy SQL writers (migrations 021–022). */
  event?: string
  /** Optional AI summary placeholder (not generated in this sprint). */
  aiSummaryRef?: string | null
  /** Optional document / workflow link placeholders. */
  documentId?: string | null
  workflowRunId?: string | null
  [key: string]: unknown
}

/** Normalized platform activity (read model). */
export type PlatformActivity = {
  id: string
  householdId: string
  /** DB enum `public.activity_type`. */
  activityType: string
  eventKey: ActivityEventKey
  moduleKey: string | null
  title: string
  body: string | null
  actorUserId: string | null
  actorDisplayName: string | null
  actorKind: ActivityActorKind
  visibility: ActivityVisibility
  pinned: boolean
  entityType: ActivityEntityType | null
  entityId: string | null
  caseId: string | null
  leadId: string | null
  assessmentId: string | null
  opportunityId: string | null
  recommendationId: string | null
  metadata: ActivityEngineMetadata
  occurredAt: string
  createdAt: string
}

export type RecordActivityInput = {
  householdId: string
  /** Registry / engine event key. */
  eventKey: ActivityEventKey
  title: string
  body?: string | null
  moduleKey?: string
  entityType?: ActivityEntityType
  entityId?: string
  caseId?: string | null
  leadId?: string | null
  assessmentId?: string | null
  opportunityId?: string | null
  recommendationId?: string | null
  visibility?: ActivityVisibility
  pinned?: boolean
  actorKind?: ActivityActorKind
  /** Extra metadata merged after engine fields (must not strip engine keys). */
  metadata?: Record<string, unknown>
  /** Override DB enum when needed; otherwise derived from event catalog. */
  activityType?: string
  occurredAt?: string
}

export type RecordActivityResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code: 'validation' | 'insert_failed' | 'unknown' }

/** Raw row shape accepted by normalize helpers (PostgREST / tests). */
export type ActivityRowInput = {
  id: string
  household_id: string
  actor_user_id?: string | null
  actor_display_name?: string | null
  activity_type: string
  title: string
  body?: string | null
  metadata?: unknown
  occurred_at: string
  created_at?: string
  lead_id?: string | null
  assessment_id?: string | null
  opportunity_id?: string | null
  recommendation_id?: string | null
}

export type TimelineDisplayVariant =
  | 'note'
  | 'assignment'
  | 'stage'
  | 'recommendation'
  | 'task'
  | 'system'
  | 'diagnostic'

export type ActivityTimelineMapping = {
  /** Narrow CRM timeline activity type (backward compatible). */
  timelineActivityType:
    | 'note'
    | 'assignment_changed'
    | 'stage_changed'
    | 'recommendation_converted'
    | 'task_created'
    | 'task_completed'
    | 'other'
  displayVariant: TimelineDisplayVariant
}
