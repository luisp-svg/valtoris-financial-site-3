import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { useCrmAuth } from '../auth/CrmAuthContext'
import {
  createOpportunity,
  fetchCurrentAdvisorProfileId,
  fetchOpportunityAdvisorOptions,
  fetchOpportunityHouseholdOptions,
  fetchOpportunityPipelineOptions,
  fetchOpportunityServiceVerticalOptions,
  fetchOpportunityStageOptionsForPipelines,
  formatOpportunityStatusLabel,
  formatSupabaseError,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
  pickDefaultPipeline,
  pickDefaultStage,
  updateOpportunity,
} from './opportunitiesApi'
import {
  validateCreateOpportunityInput,
  validateUpdateOpportunityInput,
  type CreateOpportunityValidationContext,
} from './opportunityValidation'
import type {
  CreateOpportunityInput,
  OpportunityAdvisorOption,
  OpportunityDetail,
  OpportunityFormField,
  OpportunityHouseholdOption,
  OpportunityPipelineOption,
  OpportunityServiceVerticalOption,
  OpportunityStageOption,
  UpdateOpportunityInput,
} from './types'

export type OpportunityFormMode = 'create' | 'edit'

export type OpportunityFormDialogProps = {
  mode: OpportunityFormMode
  /** Prefill + lock household on create (household workspace). */
  defaultHouseholdId?: string | null
  opportunity?: OpportunityDetail | null
  onCancel: () => void
  onSaved: (opportunity: OpportunityDetail) => void
  onSaveFailed?: (error: unknown) => void | Promise<void>
}

type CreateFormState = {
  title: string
  household_id: string
  service_vertical_id: string
  pipeline_id: string
  stage_id: string
  assigned_advisor_id: string
  next_action: string
  next_action_due_at: string
  need_identified: boolean
}

type EditFormState = {
  title: string
  next_action: string
  next_action_due_at: string
  need_identified: boolean
}

const EMPTY_CREATE: CreateFormState = {
  title: '',
  household_id: '',
  service_vertical_id: '',
  pipeline_id: '',
  stage_id: '',
  assigned_advisor_id: '',
  next_action: '',
  next_action_due_at: '',
  need_identified: true,
}

function editFromOpportunity(opportunity: OpportunityDetail): EditFormState {
  return {
    title: opportunity.title,
    next_action: opportunity.next_action ?? '',
    next_action_due_at: opportunity.next_action_due_at ?? '',
    need_identified: opportunity.need_identified,
  }
}

/**
 * CRM-8.2A create/edit dialog.
 * Create: INSERT-supported fields only (no status selector).
 * Edit: four mutable columns only; protected facts are read-only.
 * No stage movement, reassignment, archive, or delete.
 */
export default function OpportunityFormDialog({
  mode,
  defaultHouseholdId = null,
  opportunity = null,
  onCancel,
  onSaved,
  onSaveFailed,
}: OpportunityFormDialogProps) {
  const headingId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const { profile, role } = useCrmAuth()

  const [createForm, setCreateForm] = useState<CreateFormState>(() => ({
    ...EMPTY_CREATE,
    household_id: defaultHouseholdId ?? '',
  }))
  const [editForm, setEditForm] = useState<EditFormState>(() =>
    mode === 'edit' && opportunity ? editFromOpportunity(opportunity) : {
      title: '',
      next_action: '',
      next_action_due_at: '',
      need_identified: true,
    },
  )

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OpportunityFormField, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(mode === 'create')
  const [submitting, setSubmitting] = useState(false)

  const [households, setHouseholds] = useState<OpportunityHouseholdOption[]>([])
  const [verticals, setVerticals] = useState<OpportunityServiceVerticalOption[]>([])
  const [pipelines, setPipelines] = useState<OpportunityPipelineOption[]>([])
  const [allStages, setAllStages] = useState<OpportunityStageOption[]>([])
  const [advisors, setAdvisors] = useState<OpportunityAdvisorOption[]>([])
  const [actorAdvisorId, setActorAdvisorId] = useState<string | null>(null)

  const householdLocked = Boolean(defaultHouseholdId)
  const stagesForPipeline = allStages.filter(
    (row) =>
      row.pipeline_id === createForm.pipeline_id &&
      !row.is_won &&
      !row.is_lost &&
      !row.is_terminal,
  )
  const pipelinesForVertical = pipelines.filter(
    (row) => row.service_vertical_id === createForm.service_vertical_id,
  )

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    if (mode !== 'create' || !profile || !role) {
      setOptionsLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [householdRows, verticalRows, pipelineRows, advisorRows, currentAdvisorId] =
          await Promise.all([
            fetchOpportunityHouseholdOptions(supabase),
            fetchOpportunityServiceVerticalOptions(supabase),
            fetchOpportunityPipelineOptions(supabase),
            fetchOpportunityAdvisorOptions(supabase),
            fetchCurrentAdvisorProfileId(supabase, profile.id),
          ])

        if (cancelled) return

        let resolvedHouseholds = householdRows
        if (
          defaultHouseholdId &&
          !resolvedHouseholds.some((row) => row.id === defaultHouseholdId)
        ) {
          resolvedHouseholds = [
            { id: defaultHouseholdId, display_name: 'Selected household' },
            ...resolvedHouseholds,
          ]
        }

        // One stages request for all loaded pipelines (avoids N+1).
        const stageRows = await fetchOpportunityStageOptionsForPipelines(
          supabase,
          pipelineRows.map((row) => row.id),
        )
        if (cancelled) return

        setHouseholds(resolvedHouseholds)
        setVerticals(verticalRows)
        setPipelines(pipelineRows)
        setAllStages(stageRows)
        setAdvisors(advisorRows)
        setActorAdvisorId(currentAdvisorId)
        setCreateForm((prev) => ({
          ...prev,
          household_id: prev.household_id || defaultHouseholdId || '',
          assigned_advisor_id:
            role === 'advisor' && currentAdvisorId ? currentAdvisorId : prev.assigned_advisor_id,
        }))
      } catch (err) {
        if (!cancelled) {
          setHouseholds([])
          setVerticals([])
          setPipelines([])
          setAllStages([])
          setAdvisors([])
          setOptionsError(
            'Unable to load form options. Please try again.\n' +
              formatSupabaseError('opportunity_form_options', err),
          )
          if (import.meta.env.DEV) console.error('[crm/opportunities/form]', err)
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, profile, role, defaultHouseholdId])

  // When vertical changes, keep pipeline/stage coherent without extra fetches.
  useEffect(() => {
    if (mode !== 'create') return
    setCreateForm((prev) => {
      const validPipelines = pipelines.filter(
        (row) => row.service_vertical_id === prev.service_vertical_id,
      )
      const pipelineStillValid = validPipelines.some((row) => row.id === prev.pipeline_id)
      const nextPipeline = pipelineStillValid
        ? prev.pipeline_id
        : pickDefaultPipeline(validPipelines)?.id ?? ''
      const validStages = allStages.filter((row) => row.pipeline_id === nextPipeline)
      const stageStillValid = validStages.some((row) => row.id === prev.stage_id)
      const nextStage = stageStillValid ? prev.stage_id : pickDefaultStage(validStages)?.id ?? ''
      if (nextPipeline === prev.pipeline_id && nextStage === prev.stage_id) return prev
      return { ...prev, pipeline_id: nextPipeline, stage_id: nextStage }
    })
  }, [mode, createForm.service_vertical_id, pipelines, allStages])

  function setCreateField<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key as OpportunityFormField]
      return next
    })
  }

  function setEditField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key as OpportunityFormField]
      return next
    })
  }

  async function retryOptions() {
    setOptionsError(null)
    setOptionsLoading(true)
    // Re-trigger by toggling via a remount-friendly approach: re-run same loader.
    if (!profile || !role) {
      setOptionsLoading(false)
      return
    }
    try {
      const supabase = createSupabaseBrowserClient()
      const [householdRows, verticalRows, pipelineRows, advisorRows, currentAdvisorId] =
        await Promise.all([
          fetchOpportunityHouseholdOptions(supabase),
          fetchOpportunityServiceVerticalOptions(supabase),
          fetchOpportunityPipelineOptions(supabase),
          fetchOpportunityAdvisorOptions(supabase),
          fetchCurrentAdvisorProfileId(supabase, profile.id),
        ])
      const stageRows = await fetchOpportunityStageOptionsForPipelines(
        supabase,
        pipelineRows.map((row) => row.id),
      )
      setHouseholds(householdRows)
      setVerticals(verticalRows)
      setPipelines(pipelineRows)
      setAllStages(stageRows)
      setAdvisors(advisorRows)
      setActorAdvisorId(currentAdvisorId)
    } catch (err) {
      setOptionsError(
        'Unable to load form options. Please try again.\n' +
          formatSupabaseError('opportunity_form_options', err),
      )
    } finally {
      setOptionsLoading(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile || !role || submitting) return
    setSubmitError(null)
    setFieldErrors({})

    if (mode === 'create') {
      const input: CreateOpportunityInput = {
        title: createForm.title,
        household_id: createForm.household_id,
        pipeline_id: createForm.pipeline_id,
        stage_id: createForm.stage_id,
        service_vertical_id: createForm.service_vertical_id,
        assigned_advisor_id: createForm.assigned_advisor_id || null,
        next_action: createForm.next_action || null,
        next_action_due_at: createForm.next_action_due_at || null,
        need_identified: createForm.need_identified,
      }
      const validationContext: CreateOpportunityValidationContext = {
        pipelines: pipelinesForVertical.length > 0 ? pipelinesForVertical : pipelines,
        stages: stagesForPipeline,
        advisors,
        actorAdvisorId,
        role,
      }
      const validation = validateCreateOpportunityInput(input, validationContext)
      if (!validation.ok) {
        setFieldErrors(validation.fieldErrors)
        setSubmitError(validation.formError ?? 'Please fix the highlighted fields and try again.')
        return
      }

      setSubmitting(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const created = await createOpportunity(supabase, input, validationContext)
        onSaved(created)
      } catch (err) {
        setSubmitError(formatSupabaseError('create_opportunity', err))
        if (import.meta.env.DEV) console.error('[crm/opportunities/form]', err)
        await onSaveFailed?.(err)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!opportunity) {
      setSubmitError('Opportunity is missing.')
      return
    }

    const updateInput: UpdateOpportunityInput = {
      title: editForm.title,
      next_action: editForm.next_action || null,
      next_action_due_at: editForm.next_action_due_at || null,
      need_identified: editForm.need_identified,
    }
    const updateValidation = validateUpdateOpportunityInput(updateInput)
    if (!updateValidation.ok) {
      setFieldErrors(updateValidation.fieldErrors)
      setSubmitError(updateValidation.formError ?? 'Please fix the highlighted fields and try again.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const saved = await updateOpportunity(supabase, opportunity.id, updateInput)
      onSaved(saved)
    } catch (err) {
      setSubmitError(formatSupabaseError('update_opportunity', err))
      if (import.meta.env.DEV) console.error('[crm/opportunities/form]', err)
      await onSaveFailed?.(err)
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting
  const advisorSelectDisabled =
    busy || advisors.length === 0 || (role === 'advisor' && Boolean(actorAdvisorId))
  const referenceFailed = Boolean(optionsError)
  const referenceEmpty =
    mode === 'create' &&
    !optionsLoading &&
    !referenceFailed &&
    (households.length === 0 || verticals.length === 0 || pipelines.length === 0)

  return (
    <section
      className="crm-panel crm-opportunity-form-panel"
      aria-labelledby={headingId}
      role="dialog"
      aria-modal="false"
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{mode === 'create' ? 'New Opportunity' : 'Edit Opportunity'}</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>

      {mode === 'create' && optionsLoading ? (
        <p className="crm-muted">Loading form options…</p>
      ) : null}
      {mode === 'create' && optionsError ? (
        <div className="crm-banner crm-banner-error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          <p>{optionsError}</p>
          <button type="button" className="crm-text-btn" onClick={() => void retryOptions()} disabled={busy}>
            Retry
          </button>
        </div>
      ) : null}
      {referenceEmpty ? (
        <p className="crm-banner crm-banner-warning">
          No households, services, or pipelines are available for your account. Creation cannot
          continue until reference data is available.
        </p>
      ) : null}
      {submitError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }} role="alert">
          {submitError}
        </p>
      ) : null}

      <form className="crm-opportunity-form" onSubmit={onSubmit} noValidate>
        {mode === 'create' ? (
          <>
            <label className="crm-field">
              Opportunity title
              <input
                ref={firstFieldRef}
                value={createForm.title}
                onChange={(e) => setCreateField('title', e.target.value)}
                maxLength={200}
                required
                disabled={busy || optionsLoading || referenceFailed}
                placeholder="Term life review"
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title ? <span className="crm-field-error">{fieldErrors.title}</span> : null}
            </label>

            <div className="crm-form-grid crm-opportunity-form-grid">
              <label className="crm-field">
                Household
                <select
                  value={createForm.household_id}
                  onChange={(e) => setCreateField('household_id', e.target.value)}
                  required
                  disabled={busy || optionsLoading || referenceFailed || householdLocked}
                  aria-invalid={Boolean(fieldErrors.household_id)}
                >
                  <option value="">Select household…</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.display_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.household_id ? (
                  <span className="crm-field-error">{fieldErrors.household_id}</span>
                ) : null}
              </label>

              <label className="crm-field">
                Service vertical
                <select
                  value={createForm.service_vertical_id}
                  onChange={(e) => {
                    setCreateField('service_vertical_id', e.target.value)
                    setCreateField('pipeline_id', '')
                    setCreateField('stage_id', '')
                  }}
                  required
                  disabled={busy || optionsLoading || referenceFailed}
                  aria-invalid={Boolean(fieldErrors.service_vertical_id)}
                >
                  <option value="">Select service…</option>
                  {verticals.map((vertical) => (
                    <option key={vertical.id} value={vertical.id}>
                      {vertical.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.service_vertical_id ? (
                  <span className="crm-field-error">{fieldErrors.service_vertical_id}</span>
                ) : null}
              </label>

              <label className="crm-field">
                Pipeline
                <select
                  value={createForm.pipeline_id}
                  onChange={(e) => {
                    setCreateField('pipeline_id', e.target.value)
                    setCreateField('stage_id', '')
                  }}
                  required
                  disabled={
                    busy ||
                    optionsLoading ||
                    referenceFailed ||
                    !createForm.service_vertical_id
                  }
                  aria-invalid={Boolean(fieldErrors.pipeline_id)}
                >
                  <option value="">Select pipeline…</option>
                  {pipelinesForVertical.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.pipeline_id ? (
                  <span className="crm-field-error">{fieldErrors.pipeline_id}</span>
                ) : null}
              </label>

              <label className="crm-field">
                Initial stage
                <select
                  value={createForm.stage_id}
                  onChange={(e) => setCreateField('stage_id', e.target.value)}
                  required
                  disabled={
                    busy || optionsLoading || referenceFailed || !createForm.pipeline_id
                  }
                  aria-invalid={Boolean(fieldErrors.stage_id)}
                >
                  <option value="">Select stage…</option>
                  {stagesForPipeline.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.stage_id ? (
                  <span className="crm-field-error">{fieldErrors.stage_id}</span>
                ) : null}
              </label>

              <label className="crm-field">
                Assigned advisor
                <select
                  value={createForm.assigned_advisor_id}
                  onChange={(e) => setCreateField('assigned_advisor_id', e.target.value)}
                  disabled={advisorSelectDisabled || optionsLoading || referenceFailed}
                  aria-invalid={Boolean(fieldErrors.assigned_advisor_id)}
                >
                  <option value="">Unassigned</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.display_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.assigned_advisor_id ? (
                  <span className="crm-field-error">{fieldErrors.assigned_advisor_id}</span>
                ) : null}
              </label>
            </div>

            <label className="crm-field">
              Next action
              <input
                value={createForm.next_action}
                onChange={(e) => setCreateField('next_action', e.target.value)}
                maxLength={500}
                disabled={busy || optionsLoading || referenceFailed}
                placeholder="Optional next step"
              />
              {fieldErrors.next_action ? (
                <span className="crm-field-error">{fieldErrors.next_action}</span>
              ) : null}
            </label>

            <div className="crm-form-grid crm-opportunity-form-grid">
              <label className="crm-field">
                Next action due
                <input
                  type="date"
                  value={createForm.next_action_due_at}
                  onChange={(e) => setCreateField('next_action_due_at', e.target.value)}
                  disabled={busy || optionsLoading || referenceFailed}
                />
                {fieldErrors.next_action_due_at ? (
                  <span className="crm-field-error">{fieldErrors.next_action_due_at}</span>
                ) : null}
              </label>

              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={createForm.need_identified}
                  onChange={(e) => setCreateField('need_identified', e.target.checked)}
                  disabled={busy || optionsLoading || referenceFailed}
                />
                Need identified
              </label>
            </div>
          </>
        ) : opportunity ? (
          <>
            <dl className="crm-opportunity-form-readonly" aria-label="Protected opportunity fields">
              <div>
                <dt>Household</dt>
                <dd>{getOpportunityHouseholdLabel(opportunity)}</dd>
              </div>
              <div>
                <dt>Pipeline</dt>
                <dd>{getOpportunityPipelineLabel(opportunity)}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{getOpportunityStageLabel(opportunity)}</dd>
              </div>
              <div>
                <dt>Service vertical</dt>
                <dd>{getOpportunityVerticalLabel(opportunity)}</dd>
              </div>
              <div>
                <dt>Assigned advisor</dt>
                <dd>{getOpportunityOwnerLabel(opportunity)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{formatOpportunityStatusLabel(opportunity.status)}</dd>
              </div>
            </dl>

            <label className="crm-field">
              Opportunity title
              <input
                ref={firstFieldRef}
                value={editForm.title}
                onChange={(e) => setEditField('title', e.target.value)}
                maxLength={200}
                required
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title ? <span className="crm-field-error">{fieldErrors.title}</span> : null}
            </label>

            <label className="crm-field">
              Next action
              <input
                value={editForm.next_action}
                onChange={(e) => setEditField('next_action', e.target.value)}
                maxLength={500}
                disabled={busy}
              />
              {fieldErrors.next_action ? (
                <span className="crm-field-error">{fieldErrors.next_action}</span>
              ) : null}
            </label>

            <div className="crm-form-grid crm-opportunity-form-grid">
              <label className="crm-field">
                Next action due
                <input
                  type="date"
                  value={editForm.next_action_due_at}
                  onChange={(e) => setEditField('next_action_due_at', e.target.value)}
                  disabled={busy}
                />
                {fieldErrors.next_action_due_at ? (
                  <span className="crm-field-error">{fieldErrors.next_action_due_at}</span>
                ) : null}
              </label>

              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={editForm.need_identified}
                  onChange={(e) => setEditField('need_identified', e.target.checked)}
                  disabled={busy}
                />
                Need identified
              </label>
            </div>
          </>
        ) : null}

        <div className="crm-form-actions">
          <button
            type="submit"
            className="crm-primary-btn"
            disabled={
              busy ||
              (mode === 'create' && (optionsLoading || referenceFailed || referenceEmpty))
            }
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Create opportunity' : 'Save changes'}
          </button>
          <button type="button" className="crm-text-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
