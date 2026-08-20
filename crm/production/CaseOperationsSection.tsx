import { useEffect, useState, type FormEvent } from 'react'
import type { CrmSupportedRole } from '../types'
import type { ProductionApplicationDetail } from './types'
import { formatCaseDeliveryStatusLabel } from './caseWorkspace'
import { formatProductionDeliveryLabel } from './labels'
import { formatProductionDate } from './productionApi'
import {
  CASE_OPERATIONS_NOTES_MAX,
  ISSUED_DELIVERY_EDIT_STATUSES,
  buildCaseOperationsPayload,
  canShowCaseOperations,
  caseOperationsEligibility,
  isCaseOperationsDirty,
  isIssuedDeliveryEditStatus,
  sanitizeCaseOperationsPatch,
  toCaseOperationsDraft,
  type CaseOperationsDraft,
} from './caseOperationsView'
import { saveCaseOperations } from './applicationApi'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { isFollowUpOverdue } from './daysInStage'

type CaseOperationsSectionProps = {
  application: ProductionApplicationDetail
  role: CrmSupportedRole | null
  onSaved: () => void
}

export default function CaseOperationsSection({
  application,
  role,
  onSaved,
}: CaseOperationsSectionProps) {
  const eligibility = caseOperationsEligibility({
    role,
    stage: application.production_stage,
    productLine: application.product_line,
    deliveryStatus: application.delivery_status,
    deletedAt: application.deleted_at,
  })
  const original = toCaseOperationsDraft(application)
  const [draft, setDraft] = useState<CaseOperationsDraft>(original)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setDraft(toCaseOperationsDraft(application))
    setError(null)
  }, [application])

  if (!canShowCaseOperations(eligibility)) return null

  const dirty = isCaseOperationsDirty(original, draft)
  const overdue = isFollowUpOverdue(draft.nextFollowUpDate || null, new Date())
  const deliveryLabel = formatCaseDeliveryStatusLabel(application.product_line)
  const issuedNotRequired =
    application.production_stage === 'issued' && application.delivery_status === 'not_required'

  function patchDraft(over: Partial<CaseOperationsDraft>) {
    setDraft((current) => ({ ...current, ...over }))
    setSuccess(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    const built = buildCaseOperationsPayload({ eligibility, original, draft })
    if (!built.ok) {
      setError(built.message)
      setSuccess(null)
      return
    }
    if (!built.payload) {
      setError(null)
      setSuccess('No Case Operations changes to save.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await saveCaseOperations(
        supabase,
        application.id,
        sanitizeCaseOperationsPatch(built.payload),
      )
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSuccess('Case Operations saved. The case reloaded from the server.')
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="crm-panel crm-case-operations" aria-labelledby="pp-case-operations-heading">
      <div className="crm-panel-head">
        <h2 id="pp-case-operations-heading">Case Operations</h2>
      </div>
      <p className="crm-muted">
        Low-risk operational updates for this application. Stage changes stay in the workflow
        below. Application details stay on Edit Application. Household Operational Notes are
        separate.
      </p>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="crm-banner crm-banner-success" role="status">
          {success}
        </div>
      ) : null}

      <form className="crm-case-operations-form" onSubmit={handleSubmit}>
        {eligibility.followUp ? (
          <div className="crm-case-operations-block">
            <h3 className="crm-case-operations-label">Follow-up</h3>
            <label className="crm-field">
              <span>Next follow-up date</span>
              <input
                aria-label="Next follow-up date"
                type="date"
                value={draft.nextFollowUpDate}
                onChange={(event) => patchDraft({ nextFollowUpDate: event.target.value })}
                disabled={submitting}
              />
            </label>
            <p className={overdue ? 'crm-production-overdue' : 'crm-muted'}>
              Current: {formatProductionDate(application.next_follow_up_date)}
              {overdue ? ' (overdue)' : ''}
            </p>
            <button
              type="button"
              className="crm-text-btn"
              disabled={submitting || !draft.nextFollowUpDate}
              onClick={() => patchDraft({ nextFollowUpDate: '' })}
            >
              Clear date
            </button>
            <p className="crm-muted">Saving does not change stage or create a task or reminder.</p>
          </div>
        ) : null}

        {eligibility.replacement || eligibility.exchange ? (
          <div className="crm-case-operations-block">
            <h3 className="crm-case-operations-label">Case classification</h3>
            {eligibility.replacement ? (
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={draft.isReplacement}
                  onChange={(event) => patchDraft({ isReplacement: event.target.checked })}
                  disabled={submitting}
                />
                Replacement
              </label>
            ) : null}
            {eligibility.exchange ? (
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={draft.isExchangeOrTransfer}
                  onChange={(event) => patchDraft({ isExchangeOrTransfer: event.target.checked })}
                  disabled={submitting}
                />
                Exchange / transfer
              </label>
            ) : null}
            <p className="crm-muted">
              Does not add requirements, create tasks, or change stage. Common requirement sets
              stay user-driven.
            </p>
          </div>
        ) : null}

        {eligibility.delivery ? (
          <div className="crm-case-operations-block">
            <h3 className="crm-case-operations-label">Delivery / funding</h3>
            <label className="crm-field">
              <span>{deliveryLabel}</span>
              <select
                aria-label={deliveryLabel}
                value={isIssuedDeliveryEditStatus(draft.deliveryStatus) ? draft.deliveryStatus : ''}
                onChange={(event) =>
                  patchDraft({
                    deliveryStatus: isIssuedDeliveryEditStatus(event.target.value)
                      ? event.target.value
                      : draft.deliveryStatus,
                  })
                }
                disabled={submitting}
              >
                {ISSUED_DELIVERY_EDIT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatProductionDeliveryLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <p className="crm-muted">
              Current: {formatProductionDeliveryLabel(application.delivery_status)}. This does not
              place the case in force. Not required stays on the in-force transition.
            </p>
          </div>
        ) : null}

        {issuedNotRequired ? (
          <div className="crm-case-operations-block">
            <h3 className="crm-case-operations-label">Delivery / funding</h3>
            <p className="crm-muted">
              Delivery is not required. That value is set only with the in-force transition and a
              reason. It cannot be changed here.
            </p>
          </div>
        ) : null}

        {eligibility.notes ? (
          <div className="crm-case-operations-block">
            <h3 className="crm-case-operations-label">Application note</h3>
            <label className="crm-field">
              <span>Note for this application / case</span>
              <textarea
                aria-label="Application note"
                value={draft.notes}
                maxLength={CASE_OPERATIONS_NOTES_MAX}
                rows={4}
                onChange={(event) => patchDraft({ notes: event.target.value })}
                disabled={submitting}
              />
            </label>
            <p className="crm-muted">
              Operational case note only — do not enter medical details. This note is specific to
              this application. Household Operational Notes stay on the household timeline.
            </p>
          </div>
        ) : null}

        <div className="crm-case-operations-actions">
          <button type="submit" className="crm-primary-btn" disabled={submitting || !dirty}>
            {submitting ? 'Saving…' : 'Save Case Operations'}
          </button>
        </div>
      </form>
    </section>
  )
}
