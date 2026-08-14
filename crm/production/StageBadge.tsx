import { formatProductionStageLabel } from './labels'
import { isProductionTerminalStage } from './daysInStage'
import type { ProductionStage } from './types'

type StageBadgeProps = {
  stage: ProductionStage | string
  className?: string
}

export default function StageBadge({ stage, className = '' }: StageBadgeProps) {
  const terminal = isProductionTerminalStage(stage)
  return (
    <span
      className={`crm-production-stage-badge${terminal ? ' is-terminal' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      {formatProductionStageLabel(stage)}
    </span>
  )
}
