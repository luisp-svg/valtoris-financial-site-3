import { useEffect, useState, type FormEvent } from 'react'
import type { CrmSupportedRole } from '../types'
import type { ProductionProductLine, ProductionStage } from './types'
import {
  OTHER_LABEL_HINT,
  REOPEN_REASON_HINT,
  REQUIREMENT_CUSTOM_LABEL_MAX,
  REQUIREMENT_REOPEN_REASON_MAX,
  REQUIREMENTS_EMPTY_COPY,
  formatRequirementCodeLabel,
  formatRequirementStatusLabel,
  requirementCodesForProductLine,
  type RequirementCode,
} from './requirementCatalog'
import {
  createPolicyApplicationRequirement,
  fetchApplicationRequirementHistory,
  fetchApplicationRequirements,
  softDeletePolicyApplicationRequirement,
  transitionPolicyApplicationRequirementStatus,
  updatePolicyApplicationRequirement,
} from './requirementApi'
import { REQUIREMENT_LOAD_ERROR, formatRequirementUserError } from './requirementErrors'
import type { RequirementHistoryRow, RequirementRow } from './requirementTypes'
import {
  REQUIREMENT_ACTION_LABELS,
  blankToNull,
  canMutateRequirements,
  canSoftDeleteRequirement,
  historyVisibleForRequirement,
  previewCommonRequirements,
  requirementDisplayLabel,
  requirementStatusActions,
  validateOtherLabel,
  validateReopenReason,
  validateScheduledFor,
  type RequirementStatusAction,
} from './requirementView'
import { formatProductionDate, formatProductionDateTime } from './productionApi'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type RequirementSectionProps = {
  applicationId: string
  productLine: ProductionProductLine
  productionStage: ProductionStage
  deletedAt: string | null
  role: CrmSupportedRole | null
}

type Prompt =
  | { kind: 'schedule'; id: string }
  | { kind: 'reopen'; id: string }
  | { kind: 'due_date'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'common' }

function actionToStatus(action: RequirementStatusAction): 'open' | 'scheduled' | 'complete' | 'waived' | 'cancelled' {
  if (action === 'schedule') return 'scheduled'
  if (action === 'complete') return 'complete'
  if (action === 'waive') return 'waived'
  if (action === 'cancel') return 'cancelled'
  return 'open'
}

export default function RequirementSection({
  applicationId,
  productLine,
  productionStage,
  deletedAt,
  role,
}: RequirementSectionProps) {
  const canMutate = canMutateRequirements({ stage: productionStage, deletedAt })
  const canDelete = canSoftDeleteRequirement(role)
  const codes = requirementCodesForProductLine(productLine)

  const [rows, setRows] = useState<RequirementRow[]>([])
  const [history, setHistory] = useState<RequirementHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  const [code, setCode] = useState<RequirementCode>(codes[0] ?? 'signature')
  const [customLabel, setCustomLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)

  async function reload() {
    const supabase = createSupabaseBrowserClient()
    const [nextRows, nextHistory] = await Promise.all([
      fetchApplicationRequirements(supabase, applicationId),
      fetchApplicationRequirementHistory(supabase, applicationId),
    ])
    setRows(nextRows)
    setHistory(nextHistory)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [nextRows, nextHistory] = await Promise.all([
          fetchApplicationRequirements(supabase, applicationId),
          fetchApplicationRequirementHistory(supabase, applicationId),
        ])
        if (cancelled) return
        setRows(nextRows)
        setHistory(nextHistory)
      } catch (err) {
        if (!cancelled) setError(formatRequirementUserError(err) || REQUIREMENT_LOAD_ERROR)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId])

  function closePrompt() {
    if (pending) return
    setPrompt(null)
    setPromptValue('')
    setPromptError(null)
  }

  async function runCreate(input: {
    code: RequirementCode
    customLabel?: string | null
    dueDate?: string | null
    scheduledFor?: string | null
  }) {
    const supabase = createSupabaseBrowserClient()
    return createPolicyApplicationRequirement(supabase, {
      applicationId,
      code: input.code,
      customLabel: input.customLabel,
      dueDate: input.dueDate,
      scheduledFor: input.scheduledFor,
    })
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (pending || !canMutate) return
    setAddError(null)
    if (code === 'other') {
      const labelError = validateOtherLabel(customLabel)
      if (labelError) {
        setAddError(labelError)
        return
      }
    }
    setPending('create')
    const result = await runCreate({
      code,
      customLabel: code === 'other' ? customLabel : null,
      dueDate,
      scheduledFor,
    })
    if (!result.ok) {
      setAddError(result.message)
      setPending(null)
      return
    }
    setCustomLabel('')
    setDueDate('')
    setScheduledFor('')
    setShowAdd(false)
    setPending(null)
    try {
      await reload()
    } catch (err) {
      setError(formatRequirementUserError(err))
    }
  }

  async function handleDirectAction(row: RequirementRow, action: RequirementStatusAction) {
    if (pending || !canMutate) return
    if (action === 'schedule') {
      setPrompt({ kind: 'schedule', id: row.id })
      setPromptValue(row.scheduled_for ?? '')
      setPromptError(null)
      return
    }
    if (action === 'reopen') {
      setPrompt({ kind: 'reopen', id: row.id })
      setPromptValue('')
      setPromptError(null)
      return
    }
    setPending(`${row.id}:${action}`)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const result = await transitionPolicyApplicationRequirementStatus(supabase, {
      id: row.id,
      toStatus: actionToStatus(action),
    })
    if (!result.ok) {
      setError(result.message)
      setPending(null)
      return
    }
    setPending(null)
    try {
      await reload()
    } catch (err) {
      setError(formatRequirementUserError(err))
    }
  }

  async function handlePromptSubmit(event: FormEvent) {
    event.preventDefault()
    if (!prompt || pending) return
    const supabase = createSupabaseBrowserClient()
    if (prompt.kind === 'schedule') {
      const dateError = validateScheduledFor(promptValue)
      if (dateError) {
        setPromptError(dateError)
        return
      }
      setPending(`${prompt.id}:schedule`)
      const result = await transitionPolicyApplicationRequirementStatus(supabase, {
        id: prompt.id,
        toStatus: 'scheduled',
        scheduledFor: promptValue,
      })
      if (!result.ok) {
        setPromptError(result.message)
        setPending(null)
        return
      }
    } else if (prompt.kind === 'reopen') {
      const reasonError = validateReopenReason(promptValue)
      if (reasonError) {
        setPromptError(reasonError)
        return
      }
      setPending(`${prompt.id}:reopen`)
      const result = await transitionPolicyApplicationRequirementStatus(supabase, {
        id: prompt.id,
        toStatus: 'open',
        reason: promptValue,
      })
      if (!result.ok) {
        setPromptError(result.message)
        setPending(null)
        return
      }
    } else if (prompt.kind === 'due_date') {
      setPending(`${prompt.id}:due_date`)
      const result = await updatePolicyApplicationRequirement(supabase, prompt.id, {
        due_date: blankToNull(promptValue),
      })
      if (!result.ok) {
        setPromptError(result.message)
        setPending(null)
        return
      }
    } else if (prompt.kind === 'delete') {
      setPending(`${prompt.id}:delete`)
      const result = await softDeletePolicyApplicationRequirement(supabase, prompt.id)
      if (!result.ok) {
        setPromptError(result.message)
        setPending(null)
        return
      }
    } else if (prompt.kind === 'common') {
      const preview = previewCommonRequirements(productLine, rows)
      setPending('common')
      for (const nextCode of preview.toAdd) {
        const result = await runCreate({ code: nextCode })
        if (!result.ok) {
          setPromptError(result.message)
          setPending(null)
          return
        }
      }
    }
    setPrompt(null)
    setPromptValue('')
    setPromptError(null)
    setPending(null)
    try {
      await reload()
    } catch (err) {
      setError(formatRequirementUserError(err))
    }
  }

  const commonPreview = previewCommonRequirements(productLine, rows)
  const commonLabel =
    productLine === 'fia' ? 'Add common FIA requirements' : 'Add common Life requirements'

  return (
    <section className="crm-panel" aria-labelledby="pp-requirements-heading" aria-busy={pending != null || undefined}>
      <div className="crm-panel-head">
        <h2 id="pp-requirements-heading">Requirements</h2>
      </div>
      <p className="crm-muted">
        Administrative carrier asks only — signature, exams, suitability, funds, and similar
        paperwork. Do not record diagnoses, medications, lab values, or medical-record content.
      </p>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? <p className="crm-muted">Loading requirements…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="crm-muted">{REQUIREMENTS_EMPTY_COPY}</p>
      ) : null}

      {!canMutate ? (
        <p className="crm-muted">
          Requirements can be added after this case is submitted. Draft and pre-submitted
          applications stay empty until then.
        </p>
      ) : null}

      {!loading ? (
        <ul className="crm-requirement-list">
          {rows.map((row) => {
            const actions = requirementStatusActions(row.status)
            const entries = historyVisibleForRequirement(history, row.id)
            const historyOpen = openHistory === row.id
            return (
              <li key={row.id} className="crm-requirement-card">
                <div className="crm-requirement-card-head">
                  <strong>{requirementDisplayLabel(row)}</strong>
                  <span className={`crm-requirement-status crm-requirement-status-${row.status}`}>
                    {formatRequirementStatusLabel(row.status)}
                  </span>
                </div>
                <dl className="crm-requirement-meta">
                  {row.due_date ? (
                    <div>
                      <dt>Due</dt>
                      <dd>{formatProductionDate(row.due_date)}</dd>
                    </div>
                  ) : null}
                  {row.scheduled_for ? (
                    <div>
                      <dt>Scheduled</dt>
                      <dd>{formatProductionDate(row.scheduled_for)}</dd>
                    </div>
                  ) : null}
                  {row.completed_at ? (
                    <div>
                      <dt>Completed</dt>
                      <dd>{formatProductionDateTime(row.completed_at)}</dd>
                    </div>
                  ) : null}
                  {row.waived_at ? (
                    <div>
                      <dt>Waived</dt>
                      <dd>{formatProductionDateTime(row.waived_at)}</dd>
                    </div>
                  ) : null}
                </dl>
                {canMutate ? (
                  <div className="crm-requirement-actions">
                    {actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="crm-secondary-btn"
                        disabled={pending != null}
                        onClick={() => void handleDirectAction(row, action)}
                      >
                        {REQUIREMENT_ACTION_LABELS[action]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="crm-text-btn"
                      disabled={pending != null}
                      onClick={() => {
                        setPrompt({ kind: 'due_date', id: row.id })
                        setPromptValue(row.due_date ?? '')
                        setPromptError(null)
                      }}
                    >
                      Update due date
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="crm-text-btn"
                        disabled={pending != null}
                        onClick={() => {
                          setPrompt({ kind: 'delete', id: row.id })
                          setPromptError(null)
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                    {entries.length > 0 ? (
                      <button
                        type="button"
                        className="crm-text-btn"
                        onClick={() => setOpenHistory(historyOpen ? null : row.id)}
                      >
                        {historyOpen ? 'Hide history' : 'History'}
                      </button>
                    ) : null}
                  </div>
                ) : entries.length > 0 ? (
                  <div className="crm-requirement-actions">
                    <button
                      type="button"
                      className="crm-text-btn"
                      onClick={() => setOpenHistory(historyOpen ? null : row.id)}
                    >
                      {historyOpen ? 'Hide history' : 'History'}
                    </button>
                  </div>
                ) : null}
                {historyOpen ? (
                  <ol className="crm-requirement-history">
                    {entries.map((entry) => (
                      <li key={entry.id}>
                        <span className="crm-muted">{formatProductionDateTime(entry.changed_at)}</span>
                        {' · '}
                        {entry.from_status
                          ? `${formatRequirementStatusLabel(entry.from_status)} → `
                          : ''}
                        <strong>{formatRequirementStatusLabel(entry.to_status)}</strong>
                        {entry.reason && entry.reason !== 'soft_delete' ? (
                          <div>Reason: {entry.reason}</div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {canMutate ? (
        <div className="crm-requirement-toolbar">
          <button
            type="button"
            className="crm-secondary-btn"
            disabled={pending != null}
            onClick={() => {
              setShowAdd((open) => !open)
              setAddError(null)
            }}
          >
            {showAdd ? 'Close add form' : 'Add requirement'}
          </button>
          {commonPreview.toAdd.length > 0 ? (
            <button
              type="button"
              className="crm-text-btn"
              disabled={pending != null}
              onClick={() => {
                setPrompt({ kind: 'common' })
                setPromptError(null)
              }}
            >
              {commonLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {showAdd && canMutate ? (
        <form className="crm-requirement-add" onSubmit={(event) => void handleAdd(event)}>
          <label className="crm-field">
            <span>Requirement type</span>
            <select
              value={code}
              onChange={(event) => setCode(event.target.value as RequirementCode)}
              disabled={pending != null}
            >
              {codes.map((option) => (
                <option key={option} value={option}>
                  {formatRequirementCodeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          {code === 'other' ? (
            <label className="crm-field">
              <span>Custom label</span>
              <input
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                maxLength={REQUIREMENT_CUSTOM_LABEL_MAX}
                disabled={pending != null}
                required
                autoComplete="off"
              />
              <span className="crm-field-hint">{OTHER_LABEL_HINT}</span>
            </label>
          ) : null}
          <label className="crm-field">
            <span>Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={pending != null}
            />
          </label>
          <label className="crm-field">
            <span>Scheduled date</span>
            <input
              type="date"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              disabled={pending != null}
            />
            <span className="crm-field-hint">
              If a scheduled date is set, this requirement starts as Scheduled. Due date does not
              change status.
            </span>
          </label>
          {addError ? (
            <div className="crm-banner crm-banner-error" role="alert">
              {addError}
            </div>
          ) : null}
          <div className="crm-form-actions">
            <button type="submit" className="crm-primary-btn" disabled={pending != null}>
              {pending === 'create' ? 'Saving…' : 'Save requirement'}
            </button>
          </div>
        </form>
      ) : null}

      {prompt ? (
        <form
          className="crm-panel crm-catalog-dialog crm-requirement-prompt"
          role="dialog"
          aria-modal="true"
          onSubmit={(event) => void handlePromptSubmit(event)}
        >
          {prompt.kind === 'schedule' ? (
            <>
              <h3>Schedule requirement</h3>
              <p className="crm-muted">Choose the planned calendar date. This is separate from the due date.</p>
              <label className="crm-field">
                <span>Scheduled date</span>
                <input
                  type="date"
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  disabled={pending != null}
                  required
                />
              </label>
            </>
          ) : null}
          {prompt.kind === 'reopen' ? (
            <>
              <h3>Reopen requirement</h3>
              <label className="crm-field">
                <span>Reason</span>
                <textarea
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  maxLength={REQUIREMENT_REOPEN_REASON_MAX}
                  rows={3}
                  required
                  disabled={pending != null}
                />
                <span className="crm-field-hint">{REOPEN_REASON_HINT}</span>
              </label>
            </>
          ) : null}
          {prompt.kind === 'due_date' ? (
            <>
              <h3>Update due date</h3>
              <p className="crm-muted">Changing the due date does not change requirement status.</p>
              <label className="crm-field">
                <span>Due date</span>
                <input
                  type="date"
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  disabled={pending != null}
                />
              </label>
            </>
          ) : null}
          {prompt.kind === 'delete' ? (
            <>
              <h3>Remove requirement</h3>
              <p>
                Delete removes an incorrectly entered requirement from the normal operational view.
                Cancel is the usual action when a requirement existed but is no longer applicable.
              </p>
            </>
          ) : null}
          {prompt.kind === 'common' ? (
            <>
              <h3>{commonLabel}</h3>
              <p className="crm-muted">Nothing is added automatically. These codes are not already tracked:</p>
              <ul>
                {commonPreview.toAdd.map((nextCode) => (
                  <li key={nextCode}>{formatRequirementCodeLabel(nextCode)}</li>
                ))}
              </ul>
              {commonPreview.skipped.length > 0 ? (
                <p className="crm-muted">
                  Already present and skipped:{' '}
                  {commonPreview.skipped.map(formatRequirementCodeLabel).join(', ')}
                </p>
              ) : null}
            </>
          ) : null}
          {promptError ? (
            <div className="crm-banner crm-banner-error" role="alert">
              {promptError}
            </div>
          ) : null}
          <div className="crm-form-actions">
            <button type="button" className="crm-secondary-btn" onClick={closePrompt} disabled={pending != null}>
              Cancel
            </button>
            <button type="submit" className="crm-primary-btn" disabled={pending != null}>
              {pending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
