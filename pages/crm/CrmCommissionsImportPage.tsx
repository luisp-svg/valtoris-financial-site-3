import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CommissionImportWorkspace, {
  type ImportWorkspaceTab,
} from '../../crm/commissions/import/CommissionImportWorkspace'
import {
  createCommissionImportBatch,
  fetchCommissionImportBatch,
  fetchCommissionImportBatches,
  fetchCommissionImportRows,
  fetchResolvedImportContext,
  stageCommissionImportRows,
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
        if (!cancelled) {
          setSelectedRows(rows)
          setResolvedContext(context)
        }
      } catch {
        if (!cancelled) {
          setSelectedRows([])
          setResolvedContext(new Map())
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
