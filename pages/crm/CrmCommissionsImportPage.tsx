import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CommissionImportWorkspace, {
  type ImportWorkspaceTab,
} from '../../crm/commissions/import/CommissionImportWorkspace'
import {
  confirmDuplicateImportRow,
  createCommissionImportBatch,
  fetchCommissionImportBatch,
  fetchCommissionImportBatches,
  fetchCommissionImportRows,
  fetchFingerprintPeers,
  fetchImportApplicationCandidates,
  fetchLiveWritingAllocations,
  fetchPostedImportEvents,
  fetchResolvedImportContext,
  postCommissionImportRow,
  reviewCommissionImportRow,
  stageCommissionImportRows,
  type DuplicatePeerView,
  type ImportAllocationCandidate,
  type ImportApplicationCandidate,
  type PostedImportEventView,
} from '../../crm/commissions/import/commissionImportApi'
import {
  commissionImportTemplateCsv,
  hasZeroIncomeRows,
  parseCommissionImportCsv,
  type CanonicalImportRow,
  type CsvCellError,
} from '../../crm/commissions/import/commissionImportCsv'
import {
  COMMISSION_IMPORT_LOAD_ERROR,
  COMMISSION_IMPORT_STAGE_ERROR,
} from '../../crm/commissions/import/commissionImportErrors'
import { COMMISSION_IMPORT_PASTED_FILENAME, COMMISSION_IMPORT_TEMPLATE_FILENAME } from '../../crm/commissions/import/commissionImportConstants'
import { sha256HexFromBytes } from '../../crm/commissions/import/commissionImportSha'
import {
  canRetryStageIntoOpenBatch,
  shouldShowImportEntry,
  type CommissionImportBatchView,
  type CommissionImportRowView,
  type ResolvedImportContext,
} from '../../crm/commissions/import/commissionImportView'
import {
  eventTypeAllowedForIncome,
  isImportEventType,
  peersInCurrentBatch,
} from '../../crm/commissions/import/commissionImportReview'
import type { ImportReviewMode, ImportWorkflowState } from '../../crm/commissions/import/CommissionImportReviewPanel'
import { getProductionListPresentation } from '../../crm/production/listLoadState'
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

export default function CrmCommissionsImportPage() {
  const { role } = useCrmAuth()
  const isOwner = shouldShowImportEntry(role)
  const viewportWidth = useViewportWidth()
  const presentation = getProductionListPresentation(viewportWidth)

  const [batches, setBatches] = useState<CommissionImportBatchView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<CommissionImportRowView[]>([])
  const [resolvedContext, setResolvedContext] = useState<Map<string, ResolvedImportContext>>(
    () => new Map(),
  )
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsNonce, setRowsNonce] = useState(0)
  const [tab, setTab] = useState<ImportWorkspaceTab>('summary')
  const [postedEvents, setPostedEvents] = useState<Map<string, PostedImportEventView>>(() => new Map())
  const [applications, setApplications] = useState<ImportApplicationCandidate[]>([])
  const [allocations, setAllocations] = useState<ImportAllocationCandidate[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [allocationsLoading, setAllocationsLoading] = useState(false)
  const [peers, setPeers] = useState<DuplicatePeerView[]>([])
  const [peersLoading, setPeersLoading] = useState(false)
  const [reviewRowId, setReviewRowId] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<ImportReviewMode>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [allocationId, setAllocationId] = useState<string | null>(null)
  const [eventType, setEventType] = useState<string | null>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [postRowId, setPostRowId] = useState<string | null>(null)
  const [postReason, setPostReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const inFlightRef = useRef(false)

  const [statementIdentifier, setStatementIdentifier] = useState('')
  const [fsCode, setFsCode] = useState('')
  const [statementDate, setStatementDate] = useState('')
  const [sourceCreatedAt, setSourceCreatedAt] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [preview, setPreview] = useState<{
    rows: CanonicalImportRow[]
    warnings: CsvCellError[]
    fileName: string
    sha256: string
  } | null>(null)
  const [duplicateNotice, setDuplicateNotice] = useState<{
    duplicate: CommissionImportBatchView
    original: CommissionImportBatchView | null
  } | null>(null)
  const [stageTargetBatchId, setStageTargetBatchId] = useState<string | null>(null)
  const [stageRetryNote, setStageRetryNote] = useState<string | null>(null)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchCommissionImportBatches(supabase)
        if (!cancelled) setBatches(rows)
      } catch {
        if (!cancelled) {
          setBatches([])
          setError(COMMISSION_IMPORT_LOAD_ERROR)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner, reloadKey])

  useEffect(() => {
    if (!isOwner || !selectedBatchId) {
      setSelectedRows([])
      setResolvedContext(new Map())
      setPostedEvents(new Map())
      setRowsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setRowsLoading(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchCommissionImportRows(supabase, selectedBatchId)
        const context = await fetchResolvedImportContext(supabase, rows)
        const posted = await fetchPostedImportEvents(
          supabase,
          rows.map((row) => row.posted_commission_event_id).filter((id): id is string => Boolean(id)),
        )
        if (!cancelled) {
          setSelectedRows(rows)
          setResolvedContext(context)
          setPostedEvents(posted)
        }
      } catch {
        if (!cancelled) {
          setSelectedRows([])
          setResolvedContext(new Map())
          setPostedEvents(new Map())
          setError(COMMISSION_IMPORT_LOAD_ERROR)
        }
      } finally {
        if (!cancelled) setRowsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner, selectedBatchId, rowsNonce])

  if (!isOwner) {
    return <Navigate to={ROUTES.crmCommissions} replace />
  }

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null
  const reviewRow = selectedRows.find((row) => row.id === reviewRowId) ?? null
  const postRow = selectedRows.find((row) => row.id === postRowId) ?? null

  function resetWorkflow() {
    setReviewRowId(null)
    setReviewMode(null)
    setApplicationId(null)
    setAllocationId(null)
    setEventType(null)
    setReviewReason('')
    setPostRowId(null)
    setPostReason('')
    setActionError(null)
    setApplications([])
    setAllocations([])
    setPeers([])
  }

  function initialEventType(row: CommissionImportRowView): string | null {
    if (isImportEventType(row.resolved_event_type) && eventTypeAllowedForIncome(row.resolved_event_type, row.source_income_cents)) {
      return row.resolved_event_type
    }
    return null
  }

  async function loadApplications(row: CommissionImportRowView) {
    setApplicationsLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const rows = await fetchImportApplicationCandidates(supabase, row)
      setApplications(rows)
    } catch {
      setApplications([])
      setActionError(COMMISSION_IMPORT_LOAD_ERROR)
    } finally {
      setApplicationsLoading(false)
    }
  }

  async function loadAllocations(nextApplicationId: string | null) {
    if (!nextApplicationId) {
      setAllocations([])
      return
    }
    setAllocationsLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const rows = await fetchLiveWritingAllocations(supabase, nextApplicationId)
      setAllocations(rows)
    } catch {
      setAllocations([])
      setActionError(COMMISSION_IMPORT_LOAD_ERROR)
    } finally {
      setAllocationsLoading(false)
    }
  }

  async function loadPeers(row: CommissionImportRowView) {
    setPeersLoading(true)
    try {
      const inMemory = peersInCurrentBatch(selectedRows, row).map((peer) => ({
        ...peer,
        statementIdentifier: selectedBatch?.statement_identifier ?? null,
        sourceFile: selectedBatch?.source_file ?? null,
      }))
      const supabase = createSupabaseBrowserClient()
      const remote = await fetchFingerprintPeers(supabase, row)
      const seen = new Set(inMemory.map((peer) => peer.id))
      setPeers([...inMemory, ...remote.filter((peer) => !seen.has(peer.id))])
    } catch {
      setPeers(peersInCurrentBatch(selectedRows, row).map((peer) => ({
        ...peer,
        statementIdentifier: selectedBatch?.statement_identifier ?? null,
        sourceFile: selectedBatch?.source_file ?? null,
      })))
      setActionError(COMMISSION_IMPORT_LOAD_ERROR)
    } finally {
      setPeersLoading(false)
    }
  }

  function openResolution(row: CommissionImportRowView, mode: ImportReviewMode, copyAllocation: boolean) {
    setActionError(null)
    setPostRowId(null)
    setReviewRowId(row.id)
    setReviewMode(mode)
    const nextApplicationId = row.resolved_application_id
    setApplicationId(nextApplicationId)
    setAllocationId(copyAllocation ? row.resolved_allocation_id : null)
    setEventType(initialEventType(row))
    setReviewReason('')
    void loadApplications(row)
    void loadAllocations(nextApplicationId)
  }

  async function handleSubmitReady() {
    if (!reviewRow || actionSubmitting || inFlightRef.current) return
    inFlightRef.current = true
    setActionSubmitting(true)
    setActionError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const selectedAllocation = allocations.find((item) => item.id === allocationId) ?? null
      const result = await reviewCommissionImportRow(supabase, {
        row: reviewRow,
        applicationId,
        allocationId,
        allocationApplicationId: selectedAllocation?.applicationId ?? null,
        eventType,
        reason: reviewReason,
        distinct: reviewMode === 'distinct',
      })
      if (!result.ok) {
        setActionError(result.message)
        return
      }
      resetWorkflow()
      setRowsNonce((n) => n + 1)
      setReloadKey((n) => n + 1)
    } finally {
      inFlightRef.current = false
      setActionSubmitting(false)
    }
  }

  async function handleConfirmDuplicate(row: CommissionImportRowView) {
    if (actionSubmitting || inFlightRef.current) return
    inFlightRef.current = true
    setActionSubmitting(true)
    setActionError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await confirmDuplicateImportRow(supabase, { row, reason: reviewReason })
      if (!result.ok) {
        setActionError(result.message)
        return
      }
      resetWorkflow()
      setRowsNonce((n) => n + 1)
      setReloadKey((n) => n + 1)
    } finally {
      inFlightRef.current = false
      setActionSubmitting(false)
    }
  }

  async function handleConfirmPost() {
    if (!postRow || actionSubmitting || inFlightRef.current) return
    inFlightRef.current = true
    setActionSubmitting(true)
    setActionError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await postCommissionImportRow(supabase, { row: postRow, reason: postReason })
      if (!result.ok) {
        setActionError(result.message)
        return
      }
      resetWorkflow()
      setRowsNonce((n) => n + 1)
      setReloadKey((n) => n + 1)
    } finally {
      inFlightRef.current = false
      setActionSubmitting(false)
    }
  }

  const workflow: ImportWorkflowState = {
    applications,
    allocations,
    applicationsLoading,
    allocationsLoading,
    peers,
    peersLoading,
    postedEvents,
    reviewRowId,
    reviewMode,
    applicationId,
    allocationId,
    eventType,
    reviewReason,
    postRowId,
    postReason,
    actionError,
    submitting: actionSubmitting,
    onStartReview: (row) => {
      openResolution(row, 'review', true)
    },
    onStartDistinct: (row) => {
      void loadPeers(row)
      openResolution(row, 'distinct', false)
    },
    onOpenDuplicate: (row) => {
      setActionError(null)
      setPostRowId(null)
      setReviewRowId(row.id)
      setReviewMode(null)
      setApplicationId(null)
      setAllocationId(null)
      setEventType(null)
      void loadPeers(row)
    },
    onCancelReview: () => {
      if (!actionSubmitting) resetWorkflow()
    },
    onApplicationChange: (id) => {
      setApplicationId(id)
      setAllocationId(null)
      void loadAllocations(id)
    },
    onAllocationChange: (id) => setAllocationId(id),
    onEventTypeChange: (type) => setEventType(type || null),
    onReviewReasonChange: setReviewReason,
    onSubmitReady: () => void handleSubmitReady(),
    onConfirmDuplicate: (row) => void handleConfirmDuplicate(row),
    onRequestPost: (row) => {
      setActionError(null)
      setReviewRowId(null)
      setReviewMode(null)
      setPostRowId(row.id)
      setPostReason('')
      void loadAllocations(row.resolved_application_id)
    },
    onPostReasonChange: setPostReason,
    onConfirmPost: () => void handleConfirmPost(),
    onCancelPost: () => {
      if (!actionSubmitting) {
        setPostRowId(null)
        setPostReason('')
        setActionError(null)
      }
    },
  }

  async function handlePreview() {
    setCreateError(null)
    setDuplicateNotice(null)
    setStageTargetBatchId(null)
    setStageRetryNote(null)
    if (!statementIdentifier.trim()) {
      setCreateError('Enter a statement identifier.')
      return
    }
    try {
      let bytes: ArrayBuffer
      let fileName: string
      let text: string
      if (file) {
        bytes = await file.arrayBuffer()
        fileName = file.name
        text = new TextDecoder('utf-8').decode(bytes)
      } else if (pasteText.trim()) {
        const encoded = new TextEncoder().encode(pasteText)
        bytes = encoded.buffer
        fileName = COMMISSION_IMPORT_PASTED_FILENAME
        text = pasteText
      } else {
        setCreateError('Select a prepared CSV file or paste the same CSV.')
        return
      }
      const sha256 = await sha256HexFromBytes(bytes)
      const parsed = parseCommissionImportCsv(text)
      if (!parsed.ok) {
        setCreateError(
          parsed.errors[0]
            ? `Row ${parsed.errors[0].rowNumber}, ${parsed.errors[0].field}: ${parsed.errors[0].message}`
            : parsed.message,
        )
        return
      }
      if (hasZeroIncomeRows(parsed.parsed.rows)) {
        setCreateError('Income is 0.00 on at least one row. Correct the template before staging.')
        return
      }
      setPreview({
        rows: parsed.parsed.rows,
        warnings: parsed.parsed.warnings,
        fileName,
        sha256,
      })
    } catch {
      setCreateError('Unable to read that import file.')
    }
  }

  async function handleConfirmStage() {
    if (!preview || submitting) return
    setSubmitting(true)
    setCreateError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      let batchId = stageTargetBatchId
      if (!batchId) {
        const created = await createCommissionImportBatch(supabase, {
          sourceFile: preview.fileName,
          fileSha256: preview.sha256,
          statementIdentifier,
          fsCode,
          statementDate,
          sourceCreatedAt,
          payeeName,
        })
        if (!created.ok) {
          setCreateError(created.message)
          return
        }
        if (created.duplicate) {
          const original =
            batches.find((batch) => batch.id === created.originalBatchId) ??
            (await fetchCommissionImportBatch(supabase, created.originalBatchId))
          if (original && canRetryStageIntoOpenBatch(original)) {
            setStageTargetBatchId(original.id)
            setStageRetryNote(
              'This import file already opened a batch with no staged rows. Confirm to stage into the original batch. The duplicate-file record is not used.',
            )
            setSelectedBatchId(original.id)
            setReloadKey((n) => n + 1)
            return
          }
          setDuplicateNotice({ duplicate: created.batch, original })
          setPreview(null)
          setStageTargetBatchId(null)
          setStageRetryNote(null)
          setReloadKey((n) => n + 1)
          return
        }
        batchId = created.batch.id
        setStageTargetBatchId(batchId)
        setBatches((current) => [created.batch, ...current.filter((batch) => batch.id !== created.batch.id)])
      }
      if (!batchId) return
      const staged = await stageCommissionImportRows(supabase, {
        batchId,
        rows: preview.rows,
      })
      if (!staged.ok) {
        setCreateError(staged.message || COMMISSION_IMPORT_STAGE_ERROR)
        setSelectedBatchId(batchId)
        setStageRetryNote(
          'Staging did not finish. Confirm again to retry into the same open batch. Nothing was posted.',
        )
        setReloadKey((n) => n + 1)
        return
      }
      setPreview(null)
      setPasteText('')
      setFile(null)
      setStageTargetBatchId(null)
      setStageRetryNote(null)
      setSelectedBatchId(batchId)
      setTab('summary')
      setRowsNonce((n) => n + 1)
      setReloadKey((n) => n + 1)
    } finally {
      setSubmitting(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([commissionImportTemplateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = COMMISSION_IMPORT_TEMPLATE_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CommissionImportWorkspace
      presentation={presentation}
      loading={loading}
      error={error}
      onRetry={() => setReloadKey((n) => n + 1)}
      batches={batches}
      selectedBatch={selectedBatch}
      selectedRows={selectedRows}
      resolvedContext={resolvedContext}
      rowsLoading={rowsLoading}
      onSelectBatch={(batch) => {
        setSelectedBatchId(batch?.id ?? null)
        setTab('summary')
        resetWorkflow()
      }}
      create={{
        statementIdentifier,
        fsCode,
        statementDate,
        sourceCreatedAt,
        payeeName,
        fileName: file?.name ?? null,
        pasteText,
        submitting,
        error: createError,
        onStatementIdentifierChange: setStatementIdentifier,
        onFsCodeChange: setFsCode,
        onStatementDateChange: setStatementDate,
        onSourceCreatedAtChange: setSourceCreatedAt,
        onPayeeNameChange: setPayeeName,
        onFileChange: setFile,
        onPasteChange: setPasteText,
        onDownloadTemplate: downloadTemplate,
        onPreview: () => void handlePreview(),
      }}
      preview={
        preview
          ? {
              ...preview,
              confirming: submitting,
              confirmLabel: stageTargetBatchId ? 'Retry staging' : 'Stage rows',
              retryNote: stageRetryNote,
              onCancel: () => {
                if (!submitting) {
                  setPreview(null)
                  setStageTargetBatchId(null)
                  setStageRetryNote(null)
                }
              },
              onConfirm: () => void handleConfirmStage(),
            }
          : null
      }
      duplicateNotice={
        duplicateNotice
          ? {
              ...duplicateNotice,
              onOpenOriginal: () => {
                if (duplicateNotice.original) {
                  setSelectedBatchId(duplicateNotice.original.id)
                  setTab('summary')
                }
                setDuplicateNotice(null)
              },
              onDismiss: () => setDuplicateNotice(null),
            }
          : null
      }
      tab={tab}
      onTabChange={setTab}
      workflow={workflow}
    />
  )
}

export function CommissionImportAdvisorFallback() {
  return (
    <p>
      Commission import is owner-only. <Link to={ROUTES.crmCommissions}>Return to commissions</Link>.
    </p>
  )
}
