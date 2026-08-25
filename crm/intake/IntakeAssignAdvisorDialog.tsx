import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { fetchOpportunityAdvisorOptions } from '../opportunities/opportunitiesApi'
import type { OpportunityAdvisorOption } from '../opportunities/types'
import {
  INTAKE_ASSIGN_ADVISOR_ACTION_LABEL,
  INTAKE_ASSIGN_RPC_BEHAVIOR_COPY,
  intakeAssignConfirmationCopy,
} from './intakeAssignmentUi'

export type IntakeAssignAdvisorDialogProps = {
  householdName: string
  currentAdvisorName: string | null
  currentAdvisorId: string | null
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (advisorId: string, advisorName: string) => void | Promise<void>
}

export default function IntakeAssignAdvisorDialog({
  householdName,
  currentAdvisorName,
  currentAdvisorId,
  submitting,
  error,
  onCancel,
  onConfirm,
}: IntakeAssignAdvisorDialogProps) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [advisors, setAdvisors] = useState<OpportunityAdvisorOption[]>([])
  const [selectedAdvisorId, setSelectedAdvisorId] = useState(currentAdvisorId ?? '')
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchOpportunityAdvisorOptions(supabase)
        if (cancelled) return
        setAdvisors(rows)
        setSelectedAdvisorId((prev) => {
          if (prev && rows.some((row) => row.id === prev)) return prev
          if (currentAdvisorId && rows.some((row) => row.id === currentAdvisorId)) {
            return currentAdvisorId
          }
          return ''
        })
      } catch {
        if (!cancelled) {
          setAdvisors([])
          setOptionsError('Unable to load advisors. Please try again.')
        }
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentAdvisorId])

  const selectedAdvisor = advisors.find((row) => row.id === selectedAdvisorId) ?? null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting || optionsLoading || !selectedAdvisor) return
    void onConfirm(selectedAdvisor.id, selectedAdvisor.display_name)
  }

  async function retryAdvisors() {
    setOptionsLoading(true)
    setOptionsError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const rows = await fetchOpportunityAdvisorOptions(supabase)
      setAdvisors(rows)
    } catch {
      setAdvisors([])
      setOptionsError('Unable to load advisors. Please try again.')
    } finally {
      setOptionsLoading(false)
    }
  }

  const empty = !optionsLoading && !optionsError && advisors.length === 0

  return (
    <div className="crm-intake-dialog-backdrop" role="presentation">
      <div
        className="crm-panel crm-intake-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{INTAKE_ASSIGN_ADVISOR_ACTION_LABEL}</h2>
        <p className="crm-muted">
          Household: <strong>{householdName}</strong>
        </p>
        <p>
          Currently assigned:{' '}
          <strong>{currentAdvisorName?.trim() || 'Unassigned'}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <label className="crm-field">
            Advisor
            <select
              value={selectedAdvisorId}
              onChange={(event) => setSelectedAdvisorId(event.target.value)}
              disabled={submitting || optionsLoading || Boolean(optionsError) || empty}
              required
            >
              <option value="">Select advisor…</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.display_name}
                </option>
              ))}
            </select>
          </label>
          {optionsLoading ? <p className="crm-muted">Loading advisors…</p> : null}
          {empty ? (
            <p className="crm-banner crm-banner-warning" role="status">
              No active advisors are available to assign.
            </p>
          ) : null}
          {optionsError ? (
            <div className="crm-banner crm-banner-error" role="alert">
              <p>{optionsError}</p>
              <button type="button" className="crm-text-btn" onClick={() => void retryAdvisors()}>
                Retry
              </button>
            </div>
          ) : null}
          {selectedAdvisor ? (
            <>
              <p>{intakeAssignConfirmationCopy(selectedAdvisor.display_name)}</p>
              <p className="crm-muted">{INTAKE_ASSIGN_RPC_BEHAVIOR_COPY}</p>
            </>
          ) : null}
          {error ? (
            <p className="crm-banner crm-banner-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="crm-intake-resolution-actions">
            <button
              type="button"
              className="platform-btn platform-btn-outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className="platform-btn platform-btn-primary"
              disabled={
                submitting ||
                optionsLoading ||
                Boolean(optionsError) ||
                empty ||
                !selectedAdvisor
              }
              aria-busy={submitting}
            >
              {submitting ? 'Assigning…' : 'Assign Advisor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
