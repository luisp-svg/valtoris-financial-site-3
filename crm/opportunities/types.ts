/**
 * CRM-8.1 Opportunity domain types.
 * Normalized application shapes — not raw PostgREST embeds.
 */

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'on_hold'

/** Open-like vs terminal-ish grouping for list filters (API-ready). */
export type OpportunityStatusGroup = 'all' | 'open' | 'closed'

export type OpportunityPipelineSummary = {
  id: string
  name: string
}

export type OpportunityStageSummary = {
  id: string
  name: string
  code: string
  sort_order: number
  is_won: boolean
  is_lost: boolean
  is_terminal: boolean
}

export type OpportunityOwnerSummary = {
  id: string
  display_name: string
}

export type OpportunityHouseholdSummary = {
  id: string
  display_name: string
}

export type OpportunityServiceVerticalSummary = {
  id: string
  code: string
  name: string
}

export type OpportunityListItem = {
  id: string
  title: string
  status: OpportunityStatus
  household_id: string
  pipeline_id: string
  stage_id: string
  service_vertical_id: string
  assigned_advisor_id: string | null
  next_action: string | null
  next_action_due_at: string | null
  stage_entered_at: string | null
  closed_at: string | null
  updated_at: string
  created_at: string
  household: OpportunityHouseholdSummary | null
  pipeline: OpportunityPipelineSummary | null
  stage: OpportunityStageSummary | null
  service_vertical: OpportunityServiceVerticalSummary | null
  assigned_advisor: OpportunityOwnerSummary | null
}

export type OpportunityDetail = OpportunityListItem & {
  need_identified: boolean
  source_assessment_id: string | null
  source_lead_id: string | null
  source_recommendation_id: string | null
  assigned_at: string | null
  assignment_reason: string | null
  metadata: Record<string, unknown>
}

/**
 * Distinguishes a successful empty load from a failed load.
 * Mirrors CRM-7 WorkspaceLoadResult without inventing a global framework.
 */
export type OpportunityLoadResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      value: T
      error: string
    }

/** Activity row scoped to an opportunity (read-only CRM-8.1). */
export type OpportunityActivityRecord = {
  id: string
  household_id: string
  opportunity_id: string | null
  actor_user_id: string | null
  actor_display_name: string | null
  activity_type: string
  title: string
  body: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export type OpportunityWorkspace = {
  opportunity: OpportunityDetail
  activities: OpportunityLoadResult<OpportunityActivityRecord[]>
}

export type FetchOpportunitiesFilters = {
  /** Case-insensitive title / household name match (client-friendly; applied after fetch when needed). */
  search?: string
  pipelineId?: string
  stageId?: string
  ownerId?: string
  serviceVerticalId?: string
  /** Exact status enum match. */
  status?: OpportunityStatus
  /** open = open|on_hold; closed = won|lost. Ignored when `status` is set. */
  statusGroup?: OpportunityStatusGroup
  limit?: number
}
