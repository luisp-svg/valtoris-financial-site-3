/**
 * Post-placement policy lifecycle helpers (Migration 045).
 *
 * Application `production_stage === in_force` is the historical placement fact.
 * Current lifecycle lives on the linked `policies.status`.
 * Canceled / surrendered never imply a commission chargeback.
 */
import { getActiveLinkedPolicy } from './daysInStage'
import type { ProductionApplicationListItem } from './types'

export const POLICY_LIFECYCLE_STATUSES = ['issued', 'in_force', 'canceled', 'surrendered'] as const
export type PolicyLifecycleStatus = (typeof POLICY_LIFECYCLE_STATUSES)[number]

export const POLICY_LIFECYCLE_FILTERS = ['all', 'current_in_force', 'canceled', 'surrendered'] as const
export type PolicyLifecycleFilter = (typeof POLICY_LIFECYCLE_FILTERS)[number]

export const POLICY_LIFECYCLE_CHARGEBACK_NOTE =
  'Policy lifecycle status does not indicate whether a commission chargeback occurred.'

const LIFECYCLE_SET = new Set<string>(POLICY_LIFECYCLE_STATUSES)

export function isPlacedApplication(item: {
  production_stage: string
  deleted_at?: string | null
}): boolean {
  if (item.deleted_at != null) return false
  return item.production_stage === 'in_force'
}

export function normalizePolicyLifecycleStatus(
  status: string | null | undefined,
): PolicyLifecycleStatus | null {
  const value = status?.trim().toLowerCase() ?? ''
  if (!LIFECYCLE_SET.has(value)) return null
  return value as PolicyLifecycleStatus
}

export function linkedPolicyLifecycleStatus(
  item: Pick<ProductionApplicationListItem, 'linked_policies'>,
): PolicyLifecycleStatus | null {
  return normalizePolicyLifecycleStatus(getActiveLinkedPolicy(item)?.status)
}

export function isCurrentlyActiveLinkedPolicy(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
): boolean {
  return isPlacedApplication(item) && linkedPolicyLifecycleStatus(item) === 'in_force'
}

export function isPostPlacementTerminated(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
): boolean {
  const status = linkedPolicyLifecycleStatus(item)
  return isPlacedApplication(item) && (status === 'canceled' || status === 'surrendered')
}

export function formatPolicyLifecycleLabel(status: string | null | undefined): string | null {
  const normalized = normalizePolicyLifecycleStatus(status)
  if (normalized === 'in_force') return 'In Force'
  if (normalized === 'canceled') return 'Canceled / Early Termination'
  if (normalized === 'surrendered') return 'Surrendered'
  if (normalized === 'issued') return 'Issued'
  return null
}

export function policyLifecycleDisplayForApplication(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
): string | null {
  if (!isPlacedApplication(item)) return null
  const linked = getActiveLinkedPolicy(item)
  if (!linked) return null
  return formatPolicyLifecycleLabel(linked.status)
}

export function formatPlacedCaseLifecycleBadge(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
): string | null {
  if (!isPlacedApplication(item)) return null
  const label = policyLifecycleDisplayForApplication(item)
  if (!label) return 'Placed'
  return `Placed · ${label}`
}

export function matchesPolicyLifecycleFilter(
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
  filter: PolicyLifecycleFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'current_in_force') return isCurrentlyActiveLinkedPolicy(item)
  if (filter === 'canceled') {
    return isPlacedApplication(item) && linkedPolicyLifecycleStatus(item) === 'canceled'
  }
  if (filter === 'surrendered') {
    return isPlacedApplication(item) && linkedPolicyLifecycleStatus(item) === 'surrendered'
  }
  return true
}

export function policyLifecycleFilterLabel(filter: PolicyLifecycleFilter): string {
  if (filter === 'current_in_force') return 'Current In Force'
  if (filter === 'canceled') return 'Canceled / Early Termination'
  if (filter === 'surrendered') return 'Surrendered'
  return 'All policy statuses'
}

export type PolicyLifecycleDetailModel = {
  visible: boolean
  statusLabel: string | null
  terminatedOn: string | null
  terminationReason: string | null
  showTerminationFacts: boolean
}

export function policyLifecycleDetailModel(
  item: Pick<
    ProductionApplicationListItem,
    'production_stage' | 'deleted_at' | 'linked_policies'
  >,
): PolicyLifecycleDetailModel {
  if (!isPlacedApplication(item)) {
    return {
      visible: false,
      statusLabel: null,
      terminatedOn: null,
      terminationReason: null,
      showTerminationFacts: false,
    }
  }
  const linked = getActiveLinkedPolicy(item)
  const statusLabel = formatPolicyLifecycleLabel(linked?.status)
  const terminated = isPostPlacementTerminated(item)
  return {
    visible: true,
    statusLabel,
    terminatedOn: terminated ? linked?.terminated_on ?? null : null,
    terminationReason: terminated ? linked?.termination_reason?.trim() || null : null,
    showTerminationFacts: terminated,
  }
}
