import { Link } from 'react-router-dom'
import OpportunityAttentionFlagList from './OpportunityAttentionFlagList'
import { pipelineCardCopy } from './pipelineView'
import type { OpportunityListItem } from './types'
import { crmHouseholdPath, crmOpportunityPath } from '../../constants/routes'

type OpportunityPipelineCardProps = {
  opportunity: OpportunityListItem
  today?: string
}

export default function OpportunityPipelineCard({
  opportunity,
  today,
}: OpportunityPipelineCardProps) {
  const copy = pipelineCardCopy(opportunity, today)

  return (
    <article className="crm-opportunities-card crm-pipeline-card">
      <Link to={crmOpportunityPath(opportunity.id)} className="crm-opportunities-card-link">
        <h3 className="crm-opportunities-name crm-pipeline-card-name">{copy.householdName}</h3>
        <p className="crm-pipeline-card-product">{copy.primaryProduct}</p>
        <p className="crm-pipeline-card-stage">{copy.stage}</p>
        <OpportunityAttentionFlagList labels={copy.attention} />
        <dl className="crm-opportunities-card-meta">
          <div>
            <dt>Advisor</dt>
            <dd>{copy.advisor}</dd>
          </div>
          <div>
            <dt>Next action</dt>
            <dd>{copy.nextAction}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd className={copy.attention.includes('Overdue next action') ? 'crm-pipeline-overdue' : undefined}>
              {copy.nextActionDue}
            </dd>
          </div>
        </dl>
      </Link>
      <p className="crm-opportunities-card-footer">
        <Link
          to={crmHouseholdPath(opportunity.household_id)}
          className="crm-opportunities-secondary-link"
        >
          Open household
        </Link>
      </p>
    </article>
  )
}
