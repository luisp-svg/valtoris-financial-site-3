import type { RefObject } from 'react'
import type { CrmHouseholdWorkspace, HouseholdMemberSummary } from '../types'
import type { OpportunityDetail } from '../../opportunities/types'

export type ClientWorkspaceTabId =
  | 'overview'
  | 'financial_progress'
  | 'cases'
  | 'policies'
  | 'timeline'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'reviews'
  | 'household'

export type ClientWorkspaceTabDefinition = {
  id: ClientWorkspaceTabId
  label: string
  /** When false, tab renders a coming-soon / placeholder panel. */
  enabled: boolean
}

export type QuickActionId =
  | 'add_task'
  | 'add_note'
  | 'create_opportunity'
  | 'create_case'
  | 'upload_document'
  | 'schedule_review'

export type QuickActionAvailability = 'enabled' | 'disabled_future'

export type QuickActionDefinition = {
  id: QuickActionId
  label: string
  availability: QuickActionAvailability
  /** Shown for disabled_future actions (title + visually associated hint). */
  disabledReason?: string
}

/** Shared props for tab components that consume the once-loaded workspace. */
export type ClientWorkspaceTabProps = {
  workspace: CrmHouseholdWorkspace
  householdId: string
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export type ClientWorkspaceMembersHandlers = {
  onOpenCreateMember: () => void
  onOpenEditMember: (member: HouseholdMemberSummary) => void
  onCloseMemberForm: () => void
  onRequestDeleteMember: (member: HouseholdMemberSummary) => void
  onMemberSaved: (mode: 'create' | 'edit') => Promise<void>
  onMemberSaveFailed: () => Promise<void>
  onConfirmDeleteMember: () => Promise<void>
  onCancelDeleteMember: () => void
  deletingMember: boolean
  deleteError: string | null
  deleteConfirm: HouseholdMemberSummary | null
  memberForm:
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; member: HouseholdMemberSummary }
  actionSuccess: string | null
  addMemberButtonRef: RefObject<HTMLButtonElement>
}

export type ClientWorkspaceActivityHandlers = {
  authorUserId: string
  actionSuccess: string | null
  onRefreshAfterMutation: (successMessage: string) => Promise<void>
  onRefreshAfterFailure: () => Promise<void>
  onRetryLoad: () => Promise<void>
}

export type ClientWorkspaceOpportunityHandlers = {
  showCreateOpportunity: boolean
  onOpenCreateOpportunity: () => void
  onCancelCreateOpportunity: () => void
  onOpportunityCreated: (opportunity: OpportunityDetail) => void
}
