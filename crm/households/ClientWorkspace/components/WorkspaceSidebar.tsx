import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import {
  formatHouseholdAddress,
  getAdvisorLabel,
  getMemberDisplayName,
} from '../../householdsApi'
import type { CrmHouseholdWorkspace } from '../../types'
import {
  displayOptional,
  formatWorkspaceDate,
  getLastReviewLabel,
  getNextReviewLabel,
} from '../format'
import type { QuickActionId } from '../types'
import QuickActions from './QuickActions'

type WorkspaceSidebarProps = {
  workspace: CrmHouseholdWorkspace
  onQuickAction: (actionId: QuickActionId) => void
}

export default function WorkspaceSidebar({
  workspace,
  onQuickAction,
}: WorkspaceSidebarProps) {
  const { household, annualReview } = workspace
  const primary =
    household.members.find((member) => member.is_primary_contact) ?? household.members[0]
  const contactName = primary ? getMemberDisplayName(primary) : household.display_name
  const email = primary?.email?.trim() || household.primary_email
  const phone = primary?.phone?.trim() || household.primary_phone
  const address = formatHouseholdAddress(household)

  return (
    <aside className="crm-client-workspace-sidebar" aria-label="Client workspace sidebar">
      <Panel labelledBy="crm-client-info-heading">
        <SectionHeader title="Client Information" titleId="crm-client-info-heading" />
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Name</dt>
            <dd>{displayOptional(contactName)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{displayOptional(email)}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{displayOptional(phone)}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{displayOptional(address)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel labelledBy="crm-advisor-info-heading">
        <SectionHeader title="Advisor Information" titleId="crm-advisor-info-heading" />
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Assigned Advisor</dt>
            <dd>{getAdvisorLabel(household)}</dd>
          </div>
          <div>
            <dt>Client Since</dt>
            <dd>{formatWorkspaceDate(household.created_at)}</dd>
          </div>
          <div>
            <dt>Last Review</dt>
            <dd>{getLastReviewLabel(annualReview)}</dd>
          </div>
          <div>
            <dt>Next Review</dt>
            <dd>{getNextReviewLabel(annualReview)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel labelledBy="crm-quick-actions-heading">
        <SectionHeader title="Quick Actions" titleId="crm-quick-actions-heading" />
        <QuickActions onAction={onQuickAction} />
      </Panel>
    </aside>
  )
}
