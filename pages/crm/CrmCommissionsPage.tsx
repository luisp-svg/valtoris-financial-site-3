import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { localDateString } from '../../crm/dashboard/dates'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import AttributeCommissionEventDialog from '../../crm/commissions/AttributeCommissionEventDialog'
import CommissionWorkspace from '../../crm/commissions/CommissionWorkspace'
import RecordCommissionEventDialog from '../../crm/commissions/RecordCommissionEventDialog'
import ReverseCommissionEventDialog from '../../crm/commissions/ReverseCommissionEventDialog'
import { createManualCommissionIdempotencyKey } from '../../crm/commissions/commissionIdempotency'
import {
  defaultCommissionQueueFilters,
  filterCommissionWorkItems,
  type CommissionQueueFilters,
} from '../../crm/commissions/commissionFilters'
import { commissionListCapWarning } from '../../crm/commissions/commissionPresentation'
import { snapshotForCommissionWorkItem } from '../../crm/commissions/commissionSnapshotView'
import {
  applyCommissionPendingToWorkItems,
  currentPendingFactsForPeriod,
  formatPendingNeedsReviewCopy,
  overlayPendingOnAdvisorBreakdown,
  sumCurrentPendingCents,
  type AcceptedPendingSourceFact,
} from '../../crm/commissions/commissionPendingRead'
import { fetchCommissionPendingDashboardSource } from '../../crm/commissions/commissionPendingReadApi'
import { COMMISSION_PENDING_LIST_LOAD_ERROR } from '../../crm/commissions/pending/commissionPendingErrors'
import {
  buildCommissionWorkItems,
  summarizeUnattributedCommission,
  type CommissionWorkItem,
} from '../../crm/commissions/commissionWorkView'
import {
  attributeUnattributedCommissionEvent,
  recordPolicyWritingCommissionEvent,
  reversePolicyWritingCommissionEvent,
  type RecordCommissionEventArgs,
} from '../../crm/commissions/commissionWriteApi'
import { writingAttributionTargets } from '../../crm/commissions/commissionWriteView'
import {
  COMMISSION_PAYMENT_ALREADY_RECORDED_COPY,
  COMMISSION_PAYMENT_RECORDED_COPY,
  canOpenPendingPaymentFromSearch,
  canRecordPendingPayment,
  parseCommissionRecordPaymentSearch,
} from '../../crm/commissions/commissionPendingPayment'
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
import type { WritingCommissionEvent } from '../../crm/production/compensationView'
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

type CommissionWriteFlow =
  | {
      kind: 'record'
      item: CommissionWorkItem
      preIssue: boolean
      idempotencyKey: string
      lockedEventType?: 'paid' | 'chargeback'
      fromPending?: boolean
    }
  | {
      kind: 'reverse'
      item: CommissionWorkItem
      event: WritingCommissionEvent
    }
  | {
      kind: 'attribute'
      item: CommissionWorkItem
      event: WritingCommissionEvent
      idempotencyKey: string
    }

export default function CrmCommissionsPage() {
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const viewer: CompensationViewer = role === 'owner' ? 'owner' : 'advisor'
  const viewportWidth = useViewportWidth()

  const [items, setItems] = useState<ProductionApplicationListItem[]>([])
  const [carriers, setCarriers] = useState<ProductionCarrierOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [paidEvents, setPaidEvents] = useState<PaidCommissionListEvent[]>([])
  const [pendingFacts, setPendingFacts] = useState<AcceptedPendingSourceFact[]>([])
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expectedError, setExpectedError] = useState<string | null>(null)
  const [paidError, setPaidError] = useState<string | null>(null)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [period, setPeriod] = useState<DashboardReportingPeriod>(
    DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  )
  const [filters, setFilters] = useState<CommissionQueueFilters>(() =>
    defaultCommissionQueueFilters(),
  )
  const [reviewScope, setReviewScope] = useState<ReviewScope | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<WritingCommissionSnapshotView | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [snapshotNonce, setSnapshotNonce] = useState(0)
  const [writeFlow, setWriteFlow] = useState<CommissionWriteFlow | null>(null)
  const [writeSubmitting, setWriteSubmitting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [writeNotice, setWriteNotice] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setExpectedError(null)
      setPaidError(null)
      setPendingError(null)
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
        let pendingRows: AcceptedPendingSourceFact[] = []
        let pendingReviewRows = 0
        let pendingLoadError: string | null = null
        const applicationIds = rows.map((row) => row.id)
        const pendingRequest = isOwner
          ? fetchCommissionPendingDashboardSource(supabase, applicationIds)
          : Promise.resolve({ facts: [] as AcceptedPendingSourceFact[], reviewCount: 0 })
        const [expectedResult, paidResult, pendingResult] = await Promise.allSettled([
          fetchLiveExpectedCompensations(supabase, applicationIds),
          fetchPaidCommissionEvents(supabase, applicationIds),
          pendingRequest,
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
        if (pendingResult.status === 'fulfilled') {
          pendingRows = pendingResult.value.facts
          pendingReviewRows = pendingResult.value.reviewCount
        } else {
          pendingLoadError = COMMISSION_PENDING_LIST_LOAD_ERROR
          if (import.meta.env.DEV) {
            console.error(
              '[crm/commissions/pending]',
              formatCompensationDevError('commission-pending-list', pendingResult.reason),
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
          setPendingFacts(pendingRows)
          setPendingReviewCount(pendingReviewRows)
          setCarriers(carrierRows)
          setExpectedError(expectedLoadError)
          setPaidError(paidLoadError)
          setPendingError(pendingLoadError)
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setPaidEvents([])
          setPendingFacts([])
          setPendingReviewCount(0)
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
  }, [reloadKey, isOwner])

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

  const today = localDateString()
  const pendingCurrentFacts = useMemo(
    () => currentPendingFactsForPeriod(pendingFacts, period, today),
    [pendingFacts, period, today],
  )
  const workItems = useMemo(
    () =>
      applyCommissionPendingToWorkItems({
        items,
        workItems: buildCommissionWorkItems({ items, events: paidEvents }),
        currentFacts: pendingCurrentFacts,
      }),
    [items, paidEvents, pendingCurrentFacts],
  )
  const selectedItem = workItems.find((item) => item.id === selectedItemId) ?? null
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
  const advisorRows = useMemo(
    () => overlayPendingOnAdvisorBreakdown(compensation.rows, pendingCurrentFacts, items),
    [compensation.rows, pendingCurrentFacts, items],
  )
  const pendingCents = useMemo(
    () => sumCurrentPendingCents(pendingCurrentFacts),
    [pendingCurrentFacts],
  )
  const pendingReviewCopy = useMemo(
    () => formatPendingNeedsReviewCopy(pendingReviewCount),
    [pendingReviewCount],
  )
  const filteredWorkItems = useMemo(
    () => filterCommissionWorkItems(workItems, filters, period, today, { isOwner }),
    [workItems, filters, period, today, isOwner],
  )
  const periodWorkItems = useMemo(
    () =>
      filterCommissionWorkItems(
        workItems,
        defaultCommissionQueueFilters(),
        period,
        today,
        { isOwner },
      ),
    [workItems, period, today, isOwner],
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

  useEffect(() => {
    if (!selectedItem) {
      setSnapshot(null)
      setSnapshotError(null)
      setSnapshotLoading(false)
      return
    }
    const applicationId = selectedItem.applicationId
    const advisorId = selectedItem.advisorId
    const kind = selectedItem.kind
    let cancelled = false
    ;(async () => {
      setSnapshotLoading(true)
      setSnapshotError(null)
      const supabase = createSupabaseBrowserClient()
      const result = await fetchWritingCommissionSnapshot(supabase, applicationId)
      if (cancelled) return
      if (!result.ok) {
        setSnapshot(null)
        setSnapshotError(result.message)
        setSnapshotLoading(false)
        return
      }
      setSnapshot(
        snapshotForCommissionWorkItem(result.snapshot, {
          advisorId,
          kind,
        }),
      )
      setSnapshotLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedItem, snapshotNonce])

  useEffect(() => {
    if (!isOwner || loading || writeFlow != null) return
    const parsed = parseCommissionRecordPaymentSearch(searchParams)
    if (!parsed) return
    const match = workItems.find(
      (item) =>
        item.applicationId === parsed.applicationId && item.allocationId === parsed.allocationId,
    )
    setSearchParams({}, { replace: true })
    if (!canOpenPendingPaymentFromSearch({ isOwner, item: match })) return
    if (!match) return
    setWriteError(null)
    setWriteNotice(null)
    setSelectedItemId(match.id)
    setWriteFlow({
      kind: 'record',
      item: match,
      preIssue: false,
      idempotencyKey: createManualCommissionIdempotencyKey(),
      lockedEventType: 'paid',
      fromPending: true,
    })
  }, [isOwner, loading, workItems, searchParams, writeFlow, setSearchParams])

  function closeWriteFlow() {
    if (writeSubmitting) return
    setWriteFlow(null)
    setWriteError(null)
  }

  function openRecord(item: CommissionWorkItem, preIssue: boolean, lockedEventType?: 'chargeback') {
    if (!isOwner || item.pendingOnlyStub) return
    setWriteError(null)
    setWriteNotice(null)
    setWriteFlow({
      kind: 'record',
      item,
      preIssue,
      idempotencyKey: createManualCommissionIdempotencyKey(),
      lockedEventType,
    })
  }

  function openPendingPayment(item: CommissionWorkItem) {
    if (!canRecordPendingPayment(isOwner, item)) return
    setWriteError(null)
    setWriteNotice(null)
    setSelectedItemId(item.id)
    setWriteFlow({
      kind: 'record',
      item,
      preIssue: false,
      idempotencyKey: createManualCommissionIdempotencyKey(),
      lockedEventType: 'paid',
      fromPending: true,
    })
  }

  function openReverse(item: CommissionWorkItem, event: WritingCommissionEvent) {
    if (!isOwner || item.pendingOnlyStub) return
    setWriteError(null)
    setWriteNotice(null)
    setWriteFlow({ kind: 'reverse', item, event })
  }

  function openAttribute(item: CommissionWorkItem, event: WritingCommissionEvent) {
    if (!isOwner || item.pendingOnlyStub) return
    setWriteError(null)
    setWriteFlow({
      kind: 'attribute',
      item,
      event,
      idempotencyKey: createManualCommissionIdempotencyKey(),
    })
  }

  async function refreshAfterWrite() {
    setReloadKey((n) => n + 1)
    setSnapshotNonce((n) => n + 1)
  }

  async function handleRecord(args: RecordCommissionEventArgs) {
    if (!isOwner || writeSubmitting) return
    if (writeFlow?.kind !== 'record') return
    if (writeFlow.fromPending) {
      if (args.eventType !== 'paid' || writeFlow.preIssue || args.preIssue) return
    } else if (writeFlow.item.pendingOnlyStub) {
      return
    }
    if (
      writeFlow.lockedEventType &&
      args.eventType !== writeFlow.lockedEventType
    ) {
      return
    }
    setWriteSubmitting(true)
    setWriteError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await recordPolicyWritingCommissionEvent(supabase, args)
      if (!result.ok) {
        setWriteError(result.message)
        return
      }
      const fromPending = writeFlow.fromPending === true
      const postedItemId = writeFlow.item.id
      setWriteFlow(null)
      if (fromPending) {
        setWriteNotice(
          result.duplicate
            ? COMMISSION_PAYMENT_ALREADY_RECORDED_COPY
            : COMMISSION_PAYMENT_RECORDED_COPY,
        )
        setSelectedItemId(postedItemId)
      }
      await refreshAfterWrite()
    } finally {
      setWriteSubmitting(false)
    }
  }

  async function handleReverse(input: { eventId: string; reason: string }) {
    if (!isOwner || writeSubmitting) return
    if (writeFlow?.kind === 'reverse' && writeFlow.item.pendingOnlyStub) return
    setWriteSubmitting(true)
    setWriteError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await reversePolicyWritingCommissionEvent(supabase, input)
      if (!result.ok) {
        setWriteError(result.message)
        return
      }
      setWriteFlow(null)
      await refreshAfterWrite()
    } finally {
      setWriteSubmitting(false)
    }
  }

  async function handleAttribute(input: {
    eventId: string
    reason: string
    idempotencyKey: string
    attributions: Array<{ allocationId: string; amountCents: number }>
  }) {
    if (!isOwner || writeSubmitting) return
    if (writeFlow?.kind === 'attribute' && writeFlow.item.pendingOnlyStub) return
    setWriteSubmitting(true)
    setWriteError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await attributeUnattributedCommissionEvent(supabase, input)
      if (!result.ok) {
        setWriteError(result.message)
        return
      }
      setWriteFlow(null)
      await refreshAfterWrite()
    } finally {
      setWriteSubmitting(false)
    }
  }

  return (
    <>
    <CommissionWorkspace
      viewer={viewer}
      isOwner={isOwner}
      loading={loading}
      error={error}
      expectedError={expectedError}
      paidError={paidError}
      pendingError={isOwner ? pendingError : null}
      capWarning={commissionListCapWarning(items.length, PRODUCTION_LIST_DEFAULT_LIMIT)}
      compensation={compensation}
      pendingCents={pendingCents}
      pendingReviewCopy={isOwner ? pendingReviewCopy : null}
      advisorRows={advisorRows}
      period={period}
      onPeriodChange={setPeriod}
      workItems={workItems}
      periodWorkItems={periodWorkItems}
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
      onSelectItem={(item) => setSelectedItemId(item?.id ?? null)}
      snapshot={snapshot}
      snapshotLoading={snapshotLoading}
      snapshotError={snapshotError}
      onRetry={() => setReloadKey((n) => n + 1)}
      onRecord={(item) => openRecord(item, false)}
      onChargeback={(item) => openRecord(item, false, 'chargeback')}
      onPreIssue={(item) => openRecord(item, true)}
      onRecordPayment={openPendingPayment}
      onReverse={openReverse}
      onAttribute={openAttribute}
      writeDialogOpen={writeFlow != null}
      writeNotice={writeNotice}
    />
    {writeFlow?.kind === 'record' ? (
      <RecordCommissionEventDialog
        item={writeFlow.item}
        preIssue={writeFlow.preIssue}
        idempotencyKey={writeFlow.idempotencyKey}
        today={today}
        submitting={writeSubmitting}
        error={writeError}
        lockedEventType={writeFlow.lockedEventType}
        fromPending={writeFlow.fromPending === true}
        onCancel={closeWriteFlow}
        onConfirm={handleRecord}
      />
    ) : null}
    {writeFlow?.kind === 'reverse' ? (
      <ReverseCommissionEventDialog
        item={writeFlow.item}
        event={writeFlow.event}
        submitting={writeSubmitting}
        error={writeError}
        onCancel={closeWriteFlow}
        onConfirm={handleReverse}
      />
    ) : null}
    {writeFlow?.kind === 'attribute' ? (
      <AttributeCommissionEventDialog
        item={writeFlow.item}
        event={writeFlow.event}
        targets={writingAttributionTargets(workItems, writeFlow.item.applicationId)}
        idempotencyKey={writeFlow.idempotencyKey}
        submitting={writeSubmitting}
        error={writeError}
        onCancel={closeWriteFlow}
        onConfirm={handleAttribute}
      />
    ) : null}
    </>
  )
}
