import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import CaseCreatedBadge from '../../../opportunities/CaseCreatedBadge'
import {
  getOpportunityOwnerLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
} from '../../../opportunities/opportunitiesApi'
import { crmOpportunityPath, crmProductionPath } from '../../../../constants/routes'
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
          {opportunities.map((opportunity) => {
            const liveCase = opportunity.liveCase
            return (
              <li key={opportunity.id} className="crm-household-opportunity-row">
                <p className="crm-task-title">{opportunity.title}</p>
                {liveCase ? (
                  <CaseCreatedBadge productionStage={liveCase.productionStage} />
                ) : null}
                <p className="crm-task-meta">
                  {getOpportunityVerticalLabel(opportunity)}
                  {' · '}
                  {getOpportunityStageLabel(opportunity)}
                  {' · '}
                  {getOpportunityOwnerLabel(opportunity)}
                </p>
                {opportunity.next_action ? (
                  <p className="crm-task-meta">{opportunity.next_action}</p>
                ) : null}
                <div className="crm-household-opportunity-actions">
                  <Link
                    to={crmOpportunityPath(opportunity.id)}
                    className="crm-text-btn crm-household-opportunity-action"
                  >
                    Open Opportunity
                  </Link>
                  {liveCase ? (
                    <Link
                      to={crmProductionPath(liveCase.applicationId)}
                      className="crm-text-btn crm-household-opportunity-action"
                    >
                      Open Application
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}
