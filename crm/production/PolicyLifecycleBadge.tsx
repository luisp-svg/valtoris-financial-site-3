import {
  formatPolicyLifecycleLabel,
  normalizePolicyLifecycleStatus,
  type PolicyLifecycleStatus,
} from './policyLifecycle'

type PolicyLifecycleBadgeProps = {
  status: string | null | undefined
  className?: string
}

function toneClass(status: PolicyLifecycleStatus): string {
  if (status === 'canceled' || status === 'surrendered') return ' is-terminated'
  if (status === 'in_force') return ' is-active'
  return ''
}

export default function PolicyLifecycleBadge({ status, className = '' }: PolicyLifecycleBadgeProps) {
  const normalized = normalizePolicyLifecycleStatus(status)
  const label = formatPolicyLifecycleLabel(status)
  if (!normalized || !label) return null
  return (
    <span
      className={`crm-policy-lifecycle-badge${toneClass(normalized)}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  )
}
