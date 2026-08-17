import { useEffect, useMemo, useState } from 'react'
import { localDateString } from '../../crm/dashboard/dates'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CommissionWorkspace from '../../crm/commissions/CommissionWorkspace'
import {
  defaultCommissionQueueFilters,
  filterCommissionWorkItems,
  type CommissionQueueFilters,
} from '../../crm/commissions/commissionFilters'
import { commissionListCapWarning } from '../../crm/commissions/commissionPresentation'
import { snapshotForCommissionWorkItem } from '../../crm/commissions/commissionSnapshotView'
import {
  buildCommissionWorkItems,
  summarizeUnattributedCommission,
  type CommissionWorkItem,
} from '../../crm/commissions/commissionWorkView'
import { buildAdvisorCompensationDashboard } from '../../crm/production/advisorCompensationView'
import {
  fetchLiveExpectedCompensations,
  fetchPaidCommissionEvents,
  fetchWritingCommissionSnapshot,
  formatCompensationDevError,
  type WritingCommissionSnapshotView,
} from '../../crm/production/compensationApi'
import {
  EXPECTED_LIST_LOAD_ERROR,
  PAID_LIST_LOAD_ERROR,
} from '../../crm/production/compensationErrors'
import {
  DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  type DashboardReportingPeriod,
} from '../../crm/production/dashboardPeriod'
import type { PaidCommissionListEvent } from '../../crm/production/dashboardView'
import {
  fetchProductionAdvisorOptions,
  fetchProductionApplications,
  fetchProductionCarrierOptions,
  formatProductionSupabaseError,
  PRODUCTION_LIST_DEFAULT_LIMIT,
} from '../../crm/production/productionApi'
import type {
  CompensationViewer,
  ProductionAdvisorOption,
  ProductionApplicationListItem,
  ProductionCarrierOption,
} from '../../crm/production/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

type ReviewScope = 'all' | { advisorId: string | null }

export default function CrmCommissionsPage() {
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const viewer: CompensationViewer = role === 'owner' ? 'owner' : 'advisor'
  const viewportWidth = useViewportWidth()

  const [items, setItems] = useState<ProductionApplicationListItem[]>([])
  const [carriers, setCarriers] = useState<ProductionCarrierOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [paidEvents, setPaidEvents] = useState<PaidCommissionListEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expectedError, setExpectedError] = useState<string | null>(null)
  const [paidError, setPaidError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [period, setPeriod] = useState<DashboardReportingPeriod>(
    DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  )
  const [filters, setFilters] = useState<CommissionQueueFilters>(() =>
    defaultCommissionQueueFilters(),
  )
  const [reviewScope, setReviewScope] = useState<ReviewScope | null>(null)
  const [selectedItem, setSelectedItem] = useState<CommissionWorkItem | null>(null)
  const [snapshot, setSnapshot] = useState<WritingCommissionSnapshotView | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setExpectedError(null)
      setPaidError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [rows, carrierRows] = await Promise.all([
          fetchProductionApplications(supabase, { includeDeleted: false }),
          fetchProductionCarrierOptions(supabase),
        ])
        let expectedByApp = new Map<string, ProductionApplicationListItem['expected_compensations']>()
        let expectedLoadError: string | null = null
        let paidRows: PaidCommissionListEvent[] = []
        let paidLoadError: string | null = null
        const applicationIds = rows.map((row) => row.id)
        const [expectedResult, paidResult] = await Promise.allSettled([
          fetchLiveExpectedCompensations(supabase, applicationIds),
          fetchPaidCommissionEvents(supabase, applicationIds),
        ])
        if (expectedResult.status === 'fulfilled') {
          expectedByApp = expectedResult.value
        } else {
          expectedLoadError = EXPECTED_LIST_LOAD_ERROR
          if (import.meta.env.DEV) {
            console.error(
              '[crm/commissions/expected]',
              formatCompensationDevError('commission-expected-list', expectedResult.reason),
            )
          }
        }
        if (paidResult.status === 'fulfilled') {
          paidRows = paidResult.value
        } else {
          paidLoadError = PAID_LIST_LOAD_ERROR
          if (import.meta.env.DEV) {
            console.error(
              '[crm/commissions/paid]',
              formatCompensationDevError('commission-paid-list', paidResult.reason),
            )
          }
        }
        if (!cancelled) {
          setItems(
            rows.map((row) => ({
              ...row,
              expected_compensations: expectedByApp.get(row.id) ?? [],
            })),
          )
          setPaidEvents(paidRows)
          setCarriers(carrierRows)
          setExpectedError(expectedLoadError)
          setPaidError(paidLoadError)
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setPaidEvents([])
          setError('Unable to load commission records. Please try again.')
          if (import.meta.env.DEV) {
            console.error(
              '[crm/commissions]',
              formatProductionSupabaseError('commission-list', err),
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    if (!isOwner) {
      setAdvisors([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchProductionAdvisorOptions(supabase)
        if (!cancelled) setAdvisors(rows)
      } catch {
        if (!cancelled) setAdvisors([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner])

  useEffect(() => {
    if (!selectedItem) {
      setSnapshot(null)
      setSnapshotError(null)
      setSnapshotLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setSnapshotLoading(true)
      setSnapshotError(null)
      const supabase = createSupabaseBrowserClient()
      const result = await fetchWritingCommissionSnapshot(supabase, selectedItem.applicationId)
      if (cancelled) return
      if (!result.ok) {
        setSnapshot(null)
        setSnapshotError(result.message)
        setSnapshotLoading(false)
        return
      }
      setSnapshot(
        snapshotForCommissionWorkItem(result.snapshot, {
          advisorId: selectedItem.advisorId,
          kind: selectedItem.kind,
        }),
      )
      setSnapshotLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedItem])

  const today = localDateString()
  const workItems = useMemo(
    () => buildCommissionWorkItems({ items, events: paidEvents }),
    [items, paidEvents],
  )
  const compensation = useMemo(
    () =>
      buildAdvisorCompensationDashboard({
        items,
        events: paidEvents,
        period,
        today,
      }),
    [items, paidEvents, period, today],
  )
  const filteredWorkItems = useMemo(
    () => filterCommissionWorkItems(workItems, filters, period, today),
    [workItems, filters, period, today],
  )
  const unattributed = useMemo(
    () => summarizeUnattributedCommission({ items: workItems, viewer }),
    [workItems, viewer],
  )
  const reviewItems = useMemo(() => {
    if (reviewScope == null) return []
    if (reviewScope === 'all') return compensation.reviewItems
    return compensation.reviewItems.filter((item) => item.advisorId === reviewScope.advisorId)
  }, [compensation.reviewItems, reviewScope])

  return (
    <CommissionWorkspace
      viewer={viewer}
      isOwner={isOwner}
      loading={loading}
      error={error}
      expectedError={expectedError}
      paidError={paidError}
      capWarning={commissionListCapWarning(items.length, PRODUCTION_LIST_DEFAULT_LIMIT)}
      compensation={compensation}
      period={period}
      onPeriodChange={setPeriod}
      workItems={workItems}
      filteredWorkItems={filteredWorkItems}
      filters={filters}
      onFiltersChange={setFilters}
      carriers={carriers}
      advisors={advisors}
      unattributed={unattributed}
      viewportWidth={viewportWidth}
      reviewScope={reviewScope}
      reviewItems={reviewItems}
      onReviewScopeChange={setReviewScope}
      selectedItem={selectedItem}
      onSelectItem={setSelectedItem}
      snapshot={snapshot}
      snapshotLoading={snapshotLoading}
      snapshotError={snapshotError}
      onRetry={() => setReloadKey((n) => n + 1)}
    />
  )
}
