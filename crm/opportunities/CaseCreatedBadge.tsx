import { formatCaseCreatedStageLabel } from './convertOpportunityView'

type CaseCreatedBadgeProps = {
  productionStage?: string | null
}

/** Neutral informational chip. Not an attention/overdue flag. */
export default function CaseCreatedBadge({ productionStage }: CaseCreatedBadgeProps) {
  const stageLabel = formatCaseCreatedStageLabel(productionStage)
  return (
    <span className="crm-case-created-badge">
      Case created
      {stageLabel ? <span className="crm-case-created-stage">{stageLabel}</span> : null}
    </span>
  )
}
