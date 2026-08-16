import { formatExpectedStatusLabel } from './compensationLabels'
import type { DerivedExpectedStatus } from './compensationView'

type CompensationStatusBadgeProps = {
  status: DerivedExpectedStatus
  review?: boolean
  className?: string
}

export default function CompensationStatusBadge({
  status,
  review = false,
  className = '',
}: CompensationStatusBadgeProps) {
  const reviewMark = review || status === 'review_required' || status === 'no_rate'
  return (
    <span className={`crm-production-comp-badge${reviewMark ? ' is-review' : ''}${className ? ` ${className}` : ''}`}>
      {formatExpectedStatusLabel(status)}
    </span>
  )
}
