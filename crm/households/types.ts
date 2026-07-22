export type HouseholdStatus = 'lead' | 'prospect' | 'client' | 'inactive' | 'lost'

export type MemberRelationship =
  | 'primary'
  | 'spouse'
  | 'partner'
  | 'child'
  | 'dependent'
  | 'other'

export type AssessmentType = 'family' | 'business' | 'retirement' | 'protection'

export type HouseholdMemberSummary = {
  id: string
  first_name: string
  last_name: string
  relationship: MemberRelationship
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

export type CrmHouseholdDetail = CrmHouseholdListItem & {
  created_at: string
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

export type CrmHouseholdWorkspace = {
  household: CrmHouseholdDetail
  openTasks: HouseholdOpenTaskSummary[]
  openOpportunities: HouseholdOpenOpportunitySummary[]
  familyAssessment: HouseholdAssessmentSummary | null
  businessAssessment: HouseholdAssessmentSummary | null
  protectionAssessment: HouseholdAssessmentSummary | null
  annualReview: HouseholdAnnualReviewSummary | null
  recentActivities: HouseholdActivitySummary[]
}

export type HouseholdAssignmentFilter = 'all' | 'assigned' | 'unassigned'
