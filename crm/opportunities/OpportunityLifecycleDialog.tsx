import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  fetchOpportunityStageOptions,
  findCloseStage,
  formatOpportunityStatusLabel,
  formatSupabaseError,
  getOpportunityStageLabel,
  isOpportunityStageReloadFailure,
  listMoveDestinationStages,
  listReopenDestinationStages,
  moveOpportunityStage,
  OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE,
} from './opportunitiesApi'
import {
  stageRequiresLifecycleConfirmation,
  validateStageMove,
} from './opportunityValidation'
import type { OpportunityDetail, OpportunityStageOption } from './types'

export type OpportunityLifecycleMode = 'move' | 'close_won' | 'close_lost' | 'reopen'

export type OpportunityLifecycleDialogProps = {
  mode: OpportunityLifecycleMode
  opportunity: OpportunityDetail
  onCancel: () => void
  onMoved: (opportunity: OpportunityDetail) => void
  /** RPC succeeded but authoritative reload failed — keep success, offer retry. */
  onMovedReloadFailed?: (message: string) => void
  onMoveFailed?: (error: unknown) => void | Promise<void>
}

const LIFECYCLE_CONFIRMATION =
  'This will change the Opportunity lifecycle stage.'

function modeHeading(mode: OpportunityLifecycleMode): string {
  switch (mode) {
    case 'move':
      return 'Move Stage'
    case 'close_won':
      return 'Close as Won'
    case 'close_lost':
      return 'Close as Lost'
    case 'reopen':
      return 'Reopen Opportunity'
    default:
      return 'Lifecycle'
  }
}

function modeSubmitLabel(mode: OpportunityLifecycleMode): string {
  switch (mode) {
    case 'move':
      return 'Move stage'
    case 'close_won':
      return 'Close as Won'
    case 'close_lost':
      return 'Close as Lost'
    case 'reopen':
      return 'Reopen Opportunity'
    default:
      return 'Continue'
  }
}

/**
 * CRM-8.2B lifecycle dialog.
 * All mutations go through move_opportunity_stage — never direct column updates.
 */
export default function OpportunityLifecycleDialog({
  mode,
  opportunity,
  onCancel,
  onMoved,
  onMovedReloadFailed,
  onMoveFailed,
}: OpportunityLifecycleDialogProps) {
  const headingId = useId()
  const selectRef = useRef<HTMLSelectElement>(null)
  const submittingRef = useRef(false)

  const [stages, setStages] = useState<OpportunityStageOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Close Won/Lost can confirm immediately (destination known).
  // Reopen/Move must select a destination first, then confirm when required.
  const [confirming, setConfirming] = useState(
    mode === 'close_won' || mode === 'close_lost',
  )
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchOpportunityStageOptions(supabase, opportunity.pipeline_id)
        if (cancelled) return
        setStages(rows)
        if (mode === 'close_won') {
          const won = findCloseStage(rows, 'won')
          setSelectedStageId(won?.id ?? '')
          setPendingStageId(won?.id ?? null)
        } else if (mode === 'close_lost') {
          const lost = findCloseStage(rows, 'lost')
          setSelectedStageId(lost?.id ?? '')
          setPendingStageId(lost?.id ?? null)
        } else {
          setSelectedStageId('')
          setPendingStageId(null)
        }
      } catch (err) {
        if (!cancelled) {
          setStages([])
          setOptionsError(
            'Unable to load pipeline stages. Please try again.\n' +
              formatSupabaseError('opportunity_lifecycle_stages', err),
          )
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, opportunity.pipeline_id])

  useEffect(() => {
    if (!optionsLoading && !optionsError && (mode === 'move' || mode === 'reopen')) {
      selectRef.current?.focus()
    }
  }, [optionsLoading, optionsError, mode])

  const destinations =
    mode === 'reopen'
      ? listReopenDestinationStages(stages)
      : listMoveDestinationStages(stages, opportunity.stage_id)

  const resolvedCloseStage =
    mode === 'close_won'
      ? findCloseStage(stages, 'won')
      : mode === 'close_lost'
        ? findCloseStage(stages, 'lost')
        : null

  const pendingStage =
    (pendingStageId && stages.find((row) => row.id === pendingStageId)) ||
    (selectedStageId && stages.find((row) => row.id === selectedStageId)) ||
    resolvedCloseStage

  async function runMove(stageId: string) {
    if (submittingRef.current || submitting) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    setFieldError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const requireOpen = mode === 'reopen'
      const saved = await moveOpportunityStage(
        supabase,
        opportunity.id,
        stageId,
        stages,
        opportunity.pipeline_id,
        {
          currentStageId: opportunity.stage_id,
          requireOpenDestination: requireOpen,
        },
      )
      onMoved(saved)
    } catch (err) {
      // Distinguish A) mutation failed vs B) RPC succeeded but reload failed.
      if (isOpportunityStageReloadFailure(err)) {
        onMovedReloadFailed?.(OPPORTUNITY_STAGE_RELOAD_FAILED_USER_MESSAGE)
        return
      }
      const message = formatSupabaseError('move_opportunity_stage', err)
      setSubmitError(message)
      await onMoveFailed?.(err)
      if (import.meta.env.DEV) console.error('[crm/opportunities/lifecycle]', err)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function requestMove(stageId: string) {
    const validation = validateStageMove(
      stageId,
      stages,
      opportunity.pipeline_id,
      opportunity.stage_id,
      { requireOpenDestination: mode === 'reopen' },
    )
    if (!validation.ok) {
      setFieldError(validation.fieldErrors.stage_id ?? validation.formError ?? 'Invalid stage.')
      return
    }
    const stage = stages.find((row) => row.id === stageId)
    if (!stage) {
      setFieldError('Selected stage is not available.')
      return
    }
    const needsConfirm =
      mode === 'close_won' ||
      mode === 'close_lost' ||
      mode === 'reopen' ||
      stageRequiresLifecycleConfirmation(stage)
    if (needsConfirm) {
      setPendingStageId(stageId)
      setConfirming(true)
      return
    }
    void runMove(stageId)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting || optionsLoading || optionsError) return

    if (confirming && pendingStageId) {
      void runMove(pendingStageId)
      return
    }

    if (mode === 'close_won' || mode === 'close_lost') {
      const stage = resolvedCloseStage
      if (!stage) {
        setSubmitError(
          mode === 'close_won'
            ? 'No won stage is configured for this pipeline.'
            : 'No lost stage is configured for this pipeline.',
        )
        return
      }
      requestMove(stage.id)
      return
    }

    requestMove(selectedStageId)
  }

  const busy = submitting || optionsLoading
  const selectDisabled = busy || confirming || destinations.length === 0

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-opportunity-lifecycle-panel"
      aria-labelledby={headingId}
      role="dialog"
      aria-modal="false"
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{modeHeading(mode)}</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>

      <p className="crm-muted crm-opportunity-lifecycle-summary">
        Current stage: {getOpportunityStageLabel(opportunity)}
        {' · '}
        Status: {formatOpportunityStatusLabel(opportunity.status)}
      </p>

      {optionsLoading ? <p className="crm-muted">Loading pipeline stages…</p> : null}

      {optionsError ? (
        <div className="crm-banner crm-banner-error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          <p>{optionsError}</p>
          <button
            type="button"
            className="crm-text-btn"
            disabled={submitting}
            onClick={() => {
              setOptionsError(null)
              setOptionsLoading(true)
              const supabase = createSupabaseBrowserClient()
              void fetchOpportunityStageOptions(supabase, opportunity.pipeline_id)
                .then((rows) => {
                  setStages(rows)
                  setOptionsLoading(false)
                })
                .catch((err) => {
                  setOptionsError(
                    'Unable to load pipeline stages. Please try again.\n' +
                      formatSupabaseError('opportunity_lifecycle_stages', err),
                  )
                  setOptionsLoading(false)
                })
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {submitError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }} role="alert">
          {submitError}
        </p>
      ) : null}

      <form className="crm-opportunity-form" onSubmit={onSubmit} noValidate>
        {confirming && pendingStage ? (
          <div className="crm-banner crm-banner-warning" role="status">
            <p>
              <strong>{LIFECYCLE_CONFIRMATION}</strong>
            </p>
            <p>
              Destination: {pendingStage.name}
              {pendingStage.is_won ? ' (won)' : null}
              {pendingStage.is_lost ? ' (lost)' : null}
              {pendingStage.is_terminal && !pendingStage.is_lost && !pendingStage.is_won
                ? ' (terminal)'
                : null}
            </p>
          </div>
        ) : null}

        {!confirming && (mode === 'move' || mode === 'reopen') ? (
          <label className="crm-field">
            {mode === 'reopen' ? 'Open destination stage' : 'Destination stage'}
            <select
              ref={selectRef}
              value={selectedStageId}
              onChange={(e) => {
                setSelectedStageId(e.target.value)
                setFieldError(null)
              }}
              required
              disabled={selectDisabled}
              aria-invalid={Boolean(fieldError)}
            >
              <option value="">Select stage…</option>
              {destinations.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                  {stage.is_won ? ' (won)' : ''}
                  {stage.is_lost ? ' (lost)' : ''}
                </option>
              ))}
            </select>
            {fieldError ? <span className="crm-field-error">{fieldError}</span> : null}
            {destinations.length === 0 && !optionsLoading ? (
              <span className="crm-field-error">No destination stages are available.</span>
            ) : null}
          </label>
        ) : null}

        {!confirming && (mode === 'close_won' || mode === 'close_lost') ? (
          <p className="crm-muted">
            {resolvedCloseStage
              ? `This will move the opportunity to “${resolvedCloseStage.name}”.`
              : mode === 'close_won'
                ? 'No won stage is configured for this pipeline.'
                : 'No lost stage is configured for this pipeline.'}
          </p>
        ) : null}

        <div className="crm-form-actions">
          <button
            type="submit"
            className="crm-primary-btn"
            disabled={
              busy ||
              Boolean(optionsError) ||
              (confirming
                ? !pendingStageId
                : mode === 'move' || mode === 'reopen'
                  ? !selectedStageId || destinations.length === 0
                  : !resolvedCloseStage)
            }
          >
            {submitting
              ? 'Saving…'
              : confirming
                ? `Confirm — ${modeSubmitLabel(mode)}`
                : modeSubmitLabel(mode)}
          </button>
          {confirming && mode !== 'close_won' && mode !== 'close_lost' ? (
            <button
              type="button"
              className="crm-secondary-btn"
              disabled={submitting}
              onClick={() => {
                setConfirming(false)
                setPendingStageId(null)
              }}
            >
              Back
            </button>
          ) : null}
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
