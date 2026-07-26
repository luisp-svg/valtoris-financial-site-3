import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import {
  getMemberDisplayName,
  getRelationshipLabel,
} from '../../householdsApi'
import type { CrmHouseholdWorkspace } from '../../types'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function HouseholdSummaryWidget({ workspace, onNavigateTab }: Props) {
  const members = workspace.household.members
  const preview = members.slice(0, 4)

  return (
    <Widget
      title="Household Summary"
      titleId="crm-widget-household-summary"
      meta={<span className="crm-count-pill">{members.length}</span>}
      actions={
        <button
          type="button"
          className="crm-text-btn"
          onClick={() => onNavigateTab('household')}
        >
          View household
        </button>
      }
    >
      {members.length === 0 ? (
        <EmptyState
          title="No household members yet"
          description="Add members to track contacts and relationships."
          action={
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => onNavigateTab('household')}
            >
              + Add Member
            </button>
          }
        />
      ) : (
        <ul className="crm-household-overview-list">
          {preview.map((member) => (
            <li key={member.id}>
              <p className="crm-task-title">{getMemberDisplayName(member)}</p>
              <p className="crm-task-meta">
                {getRelationshipLabel(member.relationship)}
                {member.is_primary_contact ? ' · Primary contact' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
