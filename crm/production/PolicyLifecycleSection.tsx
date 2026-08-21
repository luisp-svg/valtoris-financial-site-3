import { useState } from 'react'
import type { CrmSupportedRole } from '../types'
import type { ProductionApplicationDetail } from './types'
import PolicyLifecycleBadge from './PolicyLifecycleBadge'
import {
  POLICY_LIFECYCLE_CHARGEBACK_NOTE,
  policyLifecycleDetailModel,
} from './policyLifecycle'
import { formatProductionDate } from './productionApi'
import {
  canRecordPostPlacementForApplication,
  RECORD_POST_PLACEMENT_ACTION_LABEL,
  type PostPlacementRpcArgs,
} from './policyLifecycleView'
import { recordPolicyPostPlacementOutcome } from './policyLifecycleApi'
import RecordPostPlacementOutcomeDialog from './RecordPostPlacementOutcomeDialog'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { getActiveLinkedPolicy } from './daysInStage'

type PolicyLifecycleSectionProps = {
  application: ProductionApplicationDetail
  role: CrmSupportedRole | null
  onSaved: () => void
}

export default function PolicyLifecycleSection({
  application,
  role,
  onSaved,
}: PolicyLifecycleSectionProps) {
  const lifecycle = policyLifecycleDetailModel(application)
  const linked = getActiveLinkedPolicy(application)
  const canRecord = canRecordPostPlacementForApplication(role, application)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!lifecycle.visible) return null

  async function handleConfirm(args: PostPlacementRpcArgs) {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const result = await recordPolicyPostPlacementOutcome(supabase, args)
    if (!result.ok) {
      setError(result.message)
      setSubmitting(false)
      return
    }
    setDialogOpen(false)
    setSubmitting(false)
    onSaved()
  }

  return (
    <section className="crm-panel crm-policy-lifecycle-section" aria-labelledby="pp-lifecycle-heading">
      <div className="crm-panel-head">
        <h2 id="pp-lifecycle-heading">Policy Lifecycle</h2>
      </div>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Current policy status</dt>
          <dd>
            {lifecycle.statusLabel ? (
              <PolicyLifecycleBadge status={linked?.status} />
            ) : (
              '—'
            )}
          </dd>
        </div>
        {lifecycle.showTerminationFacts ? (
          <>
            <div>
              <dt>Terminated on</dt>
              <dd>{formatProductionDate(lifecycle.terminatedOn)}</dd>
            </div>
            <div>
              <dt>Termination reason</dt>
              <dd>{lifecycle.terminationReason || '—'}</dd>
            </div>
          </>
        ) : null}
      </dl>
      <p className="crm-production-kpi-caption">{POLICY_LIFECYCLE_CHARGEBACK_NOTE}</p>
      {canRecord ? (
        <div className="crm-policy-lifecycle-actions">
          <button
            type="button"
            className="crm-secondary-btn"
            onClick={() => {
              setError(null)
              setDialogOpen(true)
            }}
            disabled={dialogOpen || submitting}
          >
            {RECORD_POST_PLACEMENT_ACTION_LABEL}
          </button>
        </div>
      ) : null}
      {dialogOpen ? (
        <RecordPostPlacementOutcomeDialog
          applicationId={application.id}
          submitting={submitting}
          error={error}
          onCancel={() => {
            if (submitting) return
            setDialogOpen(false)
            setError(null)
          }}
          onConfirm={(args) => {
            void handleConfirm(args)
          }}
        />
      ) : null}
    </section>
  )
}
