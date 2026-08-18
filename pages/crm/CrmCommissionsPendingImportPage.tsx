import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CommissionPendingImportWorkspace, {
  type PendingImportWorkspaceTab,
} from '../../crm/commissions/pending/CommissionPendingImportWorkspace'
import {
  createCommissionPendingImportBatch,
  fetchCommissionPendingImportBatch,
  fetchCommissionPendingImportBatches,
  fetchCommissionPendingImportRows,
  stageCommissionPendingImportRows,
} from '../../crm/commissions/pending/commissionPendingApi'
import {
  COMMISSION_PENDING_IMPORT_PASTED_FILENAME,
  COMMISSION_PENDING_IMPORT_TEMPLATE_FILENAME,
} from '../../crm/commissions/pending/commissionPendingConstants'
import {
  COMMISSION_PENDING_IMPORT_LOAD_ERROR,
  COMMISSION_PENDING_IMPORT_STAGE_ERROR,
} from '../../crm/commissions/pending/commissionPendingErrors'
import {
  canRetryStageIntoOpenPendingBatch,
  parseOptionalMetadataCents,
  shouldShowPendingImportEntry,
  type CommissionPendingBatchView,
  type CommissionPendingRowView,
} from '../../crm/commissions/pending/commissionPendingView'
import {
  commissionImportTemplateCsv,
  parseCommissionImportCsv,
  type CanonicalImportRow,
  type CsvCellError,
} from '../../crm/commissions/import/commissionImportCsv'
import { sha256HexFromBytes } from '../../crm/commissions/import/commissionImportSha'
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

export default function CrmCommissionsPendingImportPage() {
  const { role } = useCrmAuth()
  const isOwner = shouldShowPendingImportEntry(role)
  const viewportWidth = useViewportWidth()
  const presentation = getProductionListPresentation(viewportWidth)

  const [batches, setBatches] = useState<CommissionPendingBatchView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<CommissionPendingRowView[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsNonce, setRowsNonce] = useState(0)
  const [tab, setTab] = useState<PendingImportWorkspaceTab>('summary')

  const [statementIdentifier, setStatementIdentifier] = useState('')
  const [fsCode, setFsCode] = useState('')
  const [statementDate, setStatementDate] = useState('')
  const [sourceCreatedAt, setSourceCreatedAt] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [statementAmount, setStatementAmount] = useState('')
  const [escrow, setEscrow] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [preview, setPreview] = useState<{
    rows: CanonicalImportRow[]
    warnings: CsvCellError[]
    fileName: string
    sha256: string
    statementAmountCents: number | null
    escrowCents: number | null
  } | null>(null)
  const [duplicateNotice, setDuplicateNotice] = useState<{
    duplicate: CommissionPendingBatchView
    original: CommissionPendingBatchView | null
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
        const rows = await fetchCommissionPendingImportBatches(supabase)
        if (!cancelled) setBatches(rows)
      } catch {
        if (!cancelled) {
          setBatches([])
          setError(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
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
      setRowsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setRowsLoading(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchCommissionPendingImportRows(supabase, selectedBatchId)
        if (!cancelled) setSelectedRows(rows)
      } catch {
        if (!cancelled) {
          setSelectedRows([])
          setError(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
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
    const amount = parseOptionalMetadataCents(statementAmount)
    if (!amount.ok) {
      setCreateError(amount.message)
      return
    }
    const escrowParsed = parseOptionalMetadataCents(escrow)
    if (!escrowParsed.ok) {
      setCreateError(escrowParsed.message)
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
        fileName = COMMISSION_PENDING_IMPORT_PASTED_FILENAME
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
      setPreview({
        rows: parsed.parsed.rows,
        warnings: parsed.parsed.warnings,
        fileName,
        sha256,
        statementAmountCents: amount.cents,
        escrowCents: escrowParsed.cents,
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
        const created = await createCommissionPendingImportBatch(supabase, {
          sourceFile: preview.fileName,
          fileSha256: preview.sha256,
          statementIdentifier,
          fsCode,
          statementDate,
          sourceCreatedAt,
          payeeName,
          statementAmountCents: preview.statementAmountCents,
          escrowCents: preview.escrowCents,
        })
        if (!created.ok) {
          setCreateError(created.message)
          return
        }
        if (created.duplicate) {
          const original =
            batches.find((batch) => batch.id === created.originalBatchId) ??
            (await fetchCommissionPendingImportBatch(supabase, created.originalBatchId))
          if (original && canRetryStageIntoOpenPendingBatch(original)) {
            setStageTargetBatchId(original.id)
            setStageRetryNote(
              'This import file already opened a pending batch with no staged rows. Confirm to stage into the original batch. The duplicate-file record is not used.',
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
      const staged = await stageCommissionPendingImportRows(supabase, {
        batchId,
        rows: preview.rows,
      })
      if (!staged.ok) {
        setCreateError(staged.message || COMMISSION_PENDING_IMPORT_STAGE_ERROR)
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
    anchor.download = COMMISSION_PENDING_IMPORT_TEMPLATE_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CommissionPendingImportWorkspace
      presentation={presentation}
      loading={loading}
      error={error}
      onRetry={() => setReloadKey((n) => n + 1)}
      batches={batches}
      selectedBatch={selectedBatch}
      selectedRows={selectedRows}
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
        statementAmount,
        escrow,
        fileName: file?.name ?? null,
        pasteText,
        submitting,
        error: createError,
        onStatementIdentifierChange: setStatementIdentifier,
        onFsCodeChange: setFsCode,
        onStatementDateChange: setStatementDate,
        onSourceCreatedAtChange: setSourceCreatedAt,
        onPayeeNameChange: setPayeeName,
        onStatementAmountChange: setStatementAmount,
        onEscrowChange: setEscrow,
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

export function CommissionPendingImportAdvisorFallback() {
  return (
    <p>
      Pending commission import is owner-only.{' '}
      <Link to={ROUTES.crmCommissions}>Return to commissions</Link>.
    </p>
  )
}
