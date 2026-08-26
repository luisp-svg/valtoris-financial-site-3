import {
  formatCaseCreatedStageLabel,
  formatOpportunityApplicationHandoffLabel,
  OPPORTUNITY_CASE_ACTIVE_LABEL,
} from './convertOpportunityView'

type CaseCreatedBadgeProps = {
  productionStage?: string | null
}

/** Neutral informational chip. Not an attention/overdue flag. */
export default function CaseCreatedBadge({ productionStage }: CaseCreatedBadgeProps) {
  const handoffLabel = formatOpportunityApplicationHandoffLabel(productionStage)
  const stageLabel = formatCaseCreatedStageLabel(productionStage)
  const showStage = handoffLabel === OPPORTUNITY_CASE_ACTIVE_LABEL && Boolean(stageLabel)
  return (
    <span className="crm-case-created-badge">
      {handoffLabel}
      {showStage ? <span className="crm-case-created-stage">{stageLabel}</span> : null}
    </span>
  )
}
