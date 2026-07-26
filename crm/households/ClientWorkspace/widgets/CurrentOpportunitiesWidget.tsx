import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import { crmOpportunityPath } from '../../../../constants/routes'
import type { CrmHouseholdWorkspace } from '../../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onCreateOpportunity: () => void
}

export default function CurrentOpportunitiesWidget({
  workspace,
  onCreateOpportunity,
}: Props) {
  const opportunities = workspace.openOpportunities

  return (
    <Widget
      title="Current Opportunities"
      titleId="crm-widget-opportunities"
      meta={<span className="crm-count-pill">{opportunities.length}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={onCreateOpportunity}>
          New Opportunity
        </button>
      }
    >
      {opportunities.length === 0 ? (
        <EmptyState
          title="No open opportunities"
          description="Create an opportunity to track pipeline work for this household."
          action={
            <button type="button" className="crm-secondary-btn" onClick={onCreateOpportunity}>
              Create Opportunity
            </button>
          }
        />
      ) : (
        <ul className="crm-household-overview-list">
          {opportunities.map((opportunity) => (
            <li key={opportunity.id}>
              <p className="crm-task-title">
                <Link
                  to={crmOpportunityPath(opportunity.id)}
                  className="crm-opportunities-name-link"
                >
                  {opportunity.title}
                </Link>
              </p>
              <p className="crm-task-meta">
                {opportunity.stage?.name ?? 'Stage unavailable'}
                {opportunity.next_action ? ` · ${opportunity.next_action}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
