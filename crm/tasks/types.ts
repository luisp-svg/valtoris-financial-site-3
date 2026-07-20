export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'

export type CrmTask = {
  id: string
  household_id: string
  opportunity_id: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_user_id: string | null
  created_by_user_id: string | null
  created_at: string
  completed_at: string | null
  deleted_at: string | null
  household?: { id: string; display_name: string } | null
  assignee?: { id: string; full_name: string; email: string } | null
}

export type HouseholdOption = {
  id: string
  display_name: string
}

export type LeadOption = {
  id: string
  household_id: string
  label: string
}

export type OpportunityOption = {
  id: string
  household_id: string
  title: string
}

export type AssigneeOption = {
  id: string
  full_name: string
  email: string
  role: string
}

export type CreateTaskInput = {
  title: string
  description: string
  due_date: string | null
  priority: TaskPriority
  assigned_user_id: string | null
  household_id: string
  opportunity_id: string | null
}
