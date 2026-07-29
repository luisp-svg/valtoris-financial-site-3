export type HouseholdStatus = 'lead' | 'prospect' | 'client' | 'inactive' | 'lost'

/** DB enum values — includes legacy partner/dependent retained for existing rows. */
export type MemberRelationship =
  | 'primary'
  | 'spouse'
  | 'partner'
  | 'child'
  | 'dependent'
  | 'parent'
  | 'grandparent'
  | 'business_partner'
  | 'employee'
  | 'other'

/** Relationships offered when creating a member (or editing non-legacy values). */
export type MemberRelationshipCreateOption =
  | 'primary'
  | 'spouse'
  | 'child'
  | 'parent'
  | 'grandparent'
  | 'business_partner'
  | 'employee'
  | 'other'

export type AssessmentType = 'family' | 'business' | 'retirement' | 'protection'

export type HouseholdMemberSummary = {
  id: string
  household_id: string
  first_name: string
  last_name: string
  relationship: MemberRelationship
  is_primary_contact: boolean
  email: string | null
  phone: string | null
  date_of_birth: string | null
  created_at: string
  updated_at: string
}

export type CreateHouseholdMemberInput = {
  household_id: string
  first_name: string
  last_name: string
  relationship: MemberRelationship
  is_primary_contact: boolean
  email: string | null
  phone: string | null
  date_of_birth: string | null
}

export type UpdateHouseholdMemberInput = {
  first_name: string
  last_name: string
  relationship: MemberRelationship
  is_primary_contact: boolean
  email: string | null
  phone: string | null
  date_of_birth: string | null
}

export type HouseholdAdvisorSummary = {
  id: string
  display_name: string
}

export type HouseholdStageSummary = {
  id: string
  name: string
  code: string
}

export type CrmHouseholdListItem = {
  id: string
  display_name: string
  status: HouseholdStatus
  primary_email: string | null
  primary_phone: string | null
  assigned_advisor_id: string | null
  relationship_stage_id: string
  updated_at: string
  assigned_advisor: HouseholdAdvisorSummary | null
  relationship_stage: HouseholdStageSummary | null
  members: HouseholdMemberSummary[]
}

export type CrmHouseholdDetail = CrmHouseholdListItem & {
  created_at: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
}

export type HouseholdOpenTaskSummary = {
  id: string
  title: string
  due_date: string | null
  priority: string
  status: string
}

export type HouseholdOpenOpportunitySummary = {
  id: string
  title: string
  status: string
  next_action: string | null
  stage: { id: string; name: string } | null
}

export type HouseholdAssessmentSummary = {
  id: string
  assessment_type: AssessmentType
  overall_score: number | null
  overall_grade: string | null
  completed_at: string
  /**
   * Raw assessment answers JSON from `assessments.answers`.
   * Used by Financial Progress calculators; UI widgets ignore this field.
   */
  answers: Record<string, unknown> | null
  /**
   * Stored derived metrics from `assessments.derived_metrics`.
   * May include a previously calculated protection need for adequacy scoring.
   */
  derived_metrics: Record<string, unknown> | null
}

export type HouseholdAnnualReviewSummary = {
  id: string
  scheduled_for: string | null
  completed_at: string | null
  summary: string | null
}

export type HouseholdActivitySummary = {
  id: string
  activity_type: string
  title: string
  body: string | null
  occurred_at: string
}

/** CRM-7 note row (active notes only; soft-deleted rows are never returned). */
export type HouseholdNote = {
  id: string
  household_id: string
  opportunity_id: string | null
  author_user_id: string
  author_display_name: string | null
  body: string
  visibility: 'internal'
  created_at: string
  updated_at: string
}

export type CreateHouseholdNoteInput = {
  household_id: string
  body: string
}

/** Full activity row used by the household timeline adapter. */
export type HouseholdActivityRecord = {
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
}

export type HouseholdTimelineSourceType = 'note' | 'activity'

export type HouseholdTimelineActivityType =
  | 'note'
  | 'assignment_changed'
  | 'stage_changed'
  | 'recommendation_converted'
  | 'task_created'
  | 'task_completed'
  | 'other'

/** UI presentation hint only — not persisted and not an icon component. */
export type HouseholdTimelineDisplayVariant =
  | 'note'
  | 'assignment'
  | 'stage'
  | 'recommendation'
  | 'task'
  | 'system'

export type HouseholdTimelineItem = {
  id: string
  householdId: string
  activityType: HouseholdTimelineActivityType
  displayVariant: HouseholdTimelineDisplayVariant
  title: string
  body: string | null
  actorUserId: string | null
  actorDisplayName: string | null
  occurredAt: string
  updatedAt: string | null
  sourceEntityType: HouseholdTimelineSourceType
  sourceEntityId: string
  isEditable: boolean
  isDeletable: boolean
  isEdited: boolean
  metadata?: Record<string, unknown>
}

/**
 * Distinguishes a successful empty load from a failed load.
 * `value` is always populated (real data or domain fallback).
 */
export type WorkspaceLoadResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      value: T
      error: string
    }

export type HouseholdPolicySummary = {
  id: string
  carrier: string
  policy_type: string
  status: string
  coverage_amount: number | null
  renewal_or_review_date: string | null
  /** Named beneficiary text from `policies.beneficiary` when present. */
  beneficiary: string | null
}

export type HouseholdDocumentSummary = {
  id: string
  file_name: string
  doc_type: string
  created_at: string
}

/**
 * Household workspace payload from `fetchHouseholdWorkspace`.
 * Household Financial Progress is computed once in the Client Workspace hook
 * (not stored here — avoids coupling the fetch layer to the engine).
 */
export type CrmHouseholdWorkspace = {
  household: CrmHouseholdDetail
  openTasks: HouseholdOpenTaskSummary[]
  openOpportunities: HouseholdOpenOpportunitySummary[]
  familyAssessment: HouseholdAssessmentSummary | null
  businessAssessment: HouseholdAssessmentSummary | null
  protectionAssessment: HouseholdAssessmentSummary | null
  retirementAssessment: HouseholdAssessmentSummary | null
  annualReview: HouseholdAnnualReviewSummary | null
  /** Overview preview (activities only, limited). */
  recentActivities: HouseholdActivitySummary[]
  /**
   * CRM-7 domain payload for Activity / Timeline / Notes.
   * Use `.ok` / `.error` to distinguish empty success from load failure.
   */
  notes: WorkspaceLoadResult<HouseholdNote[]>
  activities: WorkspaceLoadResult<HouseholdActivityRecord[]>
  /**
   * Merged timeline. Built only when both notes and activities loaded successfully.
   * Empty when either source failed (do not treat as "no activity").
   */
  timeline: HouseholdTimelineItem[]
  /** True only when both notes and activities results are ok. */
  timelineComplete: boolean
  /**
   * No `cases` table exists yet — always 0 until a Cases domain is introduced.
   * Kept on the workspace payload so KPI/widgets share one source of truth.
   */
  openCasesCount: number
  /** Preview-limited active policies for UI display. */
  activePolicies: HouseholdPolicySummary[]
  /**
   * Complete active policies for Financial Progress scoring.
   * When present, the adapter prefers this over the preview-limited UI list.
   */
  financialProgressPolicies: HouseholdPolicySummary[]
  /**
   * Complete open tasks for Financial Progress scoring.
   * When present, the adapter prefers this over the preview-limited UI list.
   */
  financialProgressOpenTasks: HouseholdOpenTaskSummary[]
  recentDocuments: HouseholdDocumentSummary[]
}

export type HouseholdAssignmentFilter = 'all' | 'assigned' | 'unassigned'
