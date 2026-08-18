/**
 * Presentation adapters for the shared Commission workspace.
 *
 * Current rows are insurance Production (034/035). Labels stay generic so a
 * later P&C / Student Loan / Credit Repair adapter can feed the same shell
 * without a second Commission system. No generic DB table.
 */
import { getActiveLinkedPolicy } from '../production/daysInStage'
import type { ProductionApplicationListItem } from '../production/types'

export function commissionClientLabel(
  item: Pick<ProductionApplicationListItem, 'household'>,
): string {
  return item.household?.display_name?.trim() || 'Client'
}

/** Insurance adapter: policy number, else application number. */
export function commissionReferenceLabel(
  item: Pick<
    ProductionApplicationListItem,
    'application_number' | 'policy_number' | 'linked_policies'
  >,
): string {
  const linked = getActiveLinkedPolicy(item)
  const policy = linked?.policy_number?.trim() || item.policy_number?.trim()
  if (policy) return policy
  const application = item.application_number?.trim()
  if (application) return application
  return '—'
}

/** Insurance adapter: carrier. */
export function commissionProviderLabel(
  item: Pick<ProductionApplicationListItem, 'carrier'>,
): string {
  return item.carrier?.name?.trim() || '—'
}

/** Insurance adapter: insurance product. */
export function commissionProductServiceLabel(
  item: Pick<ProductionApplicationListItem, 'product'>,
): string {
  return item.product?.name?.trim() || '—'
}

export function commissionListCapWarning(loadedCount: number, limit: number): string | null {
  if (loadedCount !== limit) return null
  return `Showing the first ${limit} production records. Expected, Pending, Outstanding, and Paid totals may be incomplete.`
}
