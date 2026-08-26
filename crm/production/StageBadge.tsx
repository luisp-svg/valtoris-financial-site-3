import { formatCaseStageLabel } from './caseWorkspace'
import { formatProductionStageLabel } from './labels'
import { isProductionTerminalStage } from './daysInStage'
import type { ProductionStage } from './types'

type StageBadgeProps = {
  stage: ProductionStage | string
  className?: string
  /** Case workspace uses Submitted; production entry/metrics keep Applied. */
  surface?: 'production' | 'case'
}

export default function StageBadge({
  stage,
  className = '',
  surface = 'production',
}: StageBadgeProps) {
  const terminal = isProductionTerminalStage(stage)
  const label = surface === 'case' ? formatCaseStageLabel(stage) : formatProductionStageLabel(stage)
  return (
    <span
      className={`crm-production-stage-badge${terminal ? ' is-terminal' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      {label}
    </span>
  )
}
