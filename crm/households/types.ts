export type HouseholdStatus = 'lead' | 'prospect' | 'client' | 'inactive' | 'lost'

export type HouseholdMemberSummary = {
  id: string
  first_name: string
  last_name: string
  is_primary_contact: boolean
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

export type HouseholdAssignmentFilter = 'all' | 'assigned' | 'unassigned'
