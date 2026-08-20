import type { RequirementCode, RequirementStatus } from './requirementCatalog'

export type RequirementRow = {
  id: string
  application_id: string
  requirement_code: RequirementCode
  custom_label: string | null
  status: RequirementStatus
  due_date: string | null
  scheduled_for: string | null
  completed_at: string | null
  waived_at: string | null
  created_at: string
  updated_at: string
}

export type RequirementHistoryRow = {
  id: string
  requirement_id: string
  from_status: RequirementStatus | null
  to_status: RequirementStatus
  reason: string | null
  changed_at: string
}

export type RequirementUpdateFields = {
  due_date?: string | null
  scheduled_for?: string | null
  custom_label?: string | null
}

export type RequirementCreateInput = {
  applicationId: string
  code: RequirementCode
  customLabel?: string | null
  dueDate?: string | null
  scheduledFor?: string | null
}

export type RequirementTransitionInput = {
  id: string
  toStatus: RequirementStatus
  scheduledFor?: string | null
  reason?: string | null
}
