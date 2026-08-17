import type { DashboardReportingPeriod } from '../production/dashboardPeriod'
import type { ProductionProductLine, ProductionStage } from '../production/types'
import {
  type CommissionWorkDerivedStatus,
  type CommissionWorkItem,
  workItemInReportingPeriod,
} from './commissionWorkView'

export type CommissionQueueFilters = {
  search: string
  advisorId: 'all' | 'unattributed' | string
  providerId: 'all' | string
  productLine: 'all' | ProductionProductLine
  productionStage: 'all' | ProductionStage
  derivedStatus: 'all' | CommissionWorkDerivedStatus
  needsReviewOnly: boolean
}

export function defaultCommissionQueueFilters(): CommissionQueueFilters {
  return {
    search: '',
    advisorId: 'all',
    providerId: 'all',
    productLine: 'all',
    productionStage: 'all',
    derivedStatus: 'all',
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
    if (filters.needsReviewOnly && !item.derivedStatus.needsReview) return false
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
    filters.needsReviewOnly
  )
}
