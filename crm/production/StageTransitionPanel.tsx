import StageBadge from './StageBadge'
import StageTransitionConfirmDialog from './StageTransitionConfirmDialog'
import type { CrmSupportedRole } from '../types'
import type { ProductionApplicationDetail } from './types'
import {
  allowedNextStages,
  canShowStageTransitionControls,
  deliveryReadyForInForce,
  stageTransitionAction,
  type StageTransitionAction,
} from './stageTransitionView'

type StageTransitionPanelProps = {
  application: ProductionApplicationDetail
  role: CrmSupportedRole | null
  submitting: boolean
  error: string | null
  pendingAction: StageTransitionAction | null
  onSelect: (action: StageTransitionAction) => void
  onCancel: () => void
  onConfirm: (input: { reason: string; policyNumber: string }) => void
}

export default function StageTransitionPanel({
  application,
  role,
  submitting,
  error,
  pendingAction,
  onSelect,
  onCancel,
  onConfirm,
}: StageTransitionPanelProps) {
  const nextStages = allowedNextStages({
    from: application.production_stage,
    role,
    deletedAt: application.deleted_at,
    deliveryStatus: application.delivery_status,
  })
  const show = canShowStageTransitionControls({
    from: application.production_stage,
    role,
    deletedAt: application.deleted_at,
    deliveryStatus: application.delivery_status,
  })
  const issuedWaitingOnDelivery =
    application.production_stage === 'issued' &&
    !deliveryReadyForInForce(application.delivery_status)

  if (!show && !issuedWaitingOnDelivery) return null

  return (
    <section className="crm-panel" aria-labelledby="pp-stage-heading" aria-busy={submitting || undefined}>
      <div className="crm-panel-head">
        <h2 id="pp-stage-heading">Update stage</h2>
      </div>
      <p className="crm-production-comp-summary">
        <span className="crm-muted">Current stage</span>
        <StageBadge stage={application.production_stage} surface="case" />
      </p>

      {issuedWaitingOnDelivery ? (
        <p className="crm-muted">
          Delivery must be complete or not required before this policy can be placed in force.
        </p>
      ) : null}

      {error && !pendingAction ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {show ? (
        <div className="crm-production-stage-actions">
          {nextStages.map((to) => {
            const action = stageTransitionAction(application.production_stage, to, {
              policyNumber: application.policy_number,
            })
            return (
              <button
                key={to}
                type="button"
                className="crm-secondary-btn"
                disabled={submitting}
                onClick={() => {
                  if (submitting) return
                  onSelect(action)
                }}
              >
                {action.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {submitting && !pendingAction ? <p className="crm-muted">Updating stage…</p> : null}

      {pendingAction ? (
        <StageTransitionConfirmDialog
          action={pendingAction}
          submitting={submitting}
          error={error}
          initialPolicyNumber={application.policy_number ?? ''}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      ) : null}
    </section>
  )
}
