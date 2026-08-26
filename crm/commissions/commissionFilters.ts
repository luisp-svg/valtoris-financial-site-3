import type { DashboardReportingPeriod } from '../production/dashboardPeriod'
import type { ProductionProductLine, ProductionStage } from '../production/types'
import {
  commissionExceptionFlags,
  type CommissionExceptionBucket,
  workItemMatchesExceptionBucket,
} from './commissionExceptionView'
import {
  type CommissionWorkDerivedStatus,
  type CommissionWorkItem,
  workItemInReportingPeriod,
} from './commissionWorkView'

export type CommissionMoneyKindFilter = 'all' | 'paid' | 'adjustment' | 'chargeback'

export const COMMISSION_MONEY_KIND_FILTERS = [
  'all',
  'paid',
  'adjustment',
  'chargeback',
] as const satisfies readonly CommissionMoneyKindFilter[]

export type CommissionQueueFilters = {
  search: string
  advisorId: 'all' | 'unattributed' | string
  providerId: 'all' | string
  productLine: 'all' | ProductionProductLine
  productionStage: 'all' | ProductionStage
  derivedStatus: 'all' | CommissionWorkDerivedStatus
  exceptionBucket: CommissionExceptionBucket
  moneyKind: CommissionMoneyKindFilter
  needsReviewOnly: boolean
}

export type CommissionFilterViewer = {
  isOwner: boolean
}

export function defaultCommissionQueueFilters(): CommissionQueueFilters {
  return {
    search: '',
    advisorId: 'all',
    providerId: 'all',
    productLine: 'all',
    productionStage: 'all',
    derivedStatus: 'all',
    exceptionBucket: 'all',
    moneyKind: 'all',
    needsReviewOnly: false,
  }
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function includesNeedle(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle)
}

export function workItemMatchesMoneyKind(
  item: Pick<CommissionWorkItem, 'paidCents' | 'adjustmentCents' | 'chargebackCents'>,
  kind: CommissionMoneyKindFilter,
): boolean {
  if (kind === 'all') return true
  if (kind === 'paid') return item.paidCents !== 0
  if (kind === 'adjustment') return item.adjustmentCents !== 0
  return item.chargebackCents !== 0
}

export function commissionMoneyKindFilterLabel(kind: CommissionMoneyKindFilter): string {
  if (kind === 'paid') return 'Paid'
  if (kind === 'adjustment') return 'Adjustments'
  if (kind === 'chargeback') return 'Chargebacks'
  return 'All'
}

export function commissionWorkItemMatchesSearch(item: CommissionWorkItem, search: string): boolean {
  const needle = normalizeSearch(search)
  if (!needle) return true
  return (
    includesNeedle(item.clientLabel, needle) ||
    includesNeedle(item.referenceLabel, needle) ||
    includesNeedle(item.providerLabel, needle) ||
    includesNeedle(item.productServiceLabel, needle) ||
    includesNeedle(item.advisorName, needle)
  )
}

export function filterCommissionWorkItems(
  items: readonly CommissionWorkItem[],
  filters: CommissionQueueFilters,
  period: DashboardReportingPeriod,
  today: string,
  viewer: CommissionFilterViewer = { isOwner: false },
): CommissionWorkItem[] {
  return items.filter((item) => {
    if (!workItemInReportingPeriod(item, period, today)) return false
    if (!commissionWorkItemMatchesSearch(item, filters.search)) return false

    if (filters.advisorId === 'unattributed') {
      if (item.kind !== 'unattributed') return false
    } else if (filters.advisorId !== 'all' && item.advisorId !== filters.advisorId) {
      return false
    }

    if (filters.providerId !== 'all' && item.providerId !== filters.providerId) return false
    if (filters.productLine !== 'all' && item.productLine !== filters.productLine) return false
    if (filters.productionStage !== 'all' && item.productionStage !== filters.productionStage) {
      return false
    }
    if (filters.derivedStatus !== 'all' && item.derivedStatus.primary !== filters.derivedStatus) {
      return false
    }
    if (!workItemMatchesExceptionBucket(item, filters.exceptionBucket, viewer.isOwner)) {
      return false
    }
    if (!workItemMatchesMoneyKind(item, filters.moneyKind)) return false
    if (filters.needsReviewOnly) {
      if (viewer.isOwner) {
        if (!commissionExceptionFlags(item, true).needsAttention) return false
      } else if (!item.derivedStatus.needsReview) {
        return false
      }
    }
    return true
  })
}

export function hasActiveCommissionFilters(filters: CommissionQueueFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.advisorId !== 'all' ||
    filters.providerId !== 'all' ||
    filters.productLine !== 'all' ||
    filters.productionStage !== 'all' ||
    filters.derivedStatus !== 'all' ||
    filters.exceptionBucket !== 'all' ||
    filters.moneyKind !== 'all' ||
    filters.needsReviewOnly
  )
}
