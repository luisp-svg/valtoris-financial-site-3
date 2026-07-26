import { CLIENT_WORKSPACE_QUICK_ACTIONS } from '../tabConfig'
import type { QuickActionId } from '../types'

type QuickActionsProps = {
  onAction: (actionId: QuickActionId) => void
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="crm-client-workspace-quick-actions" aria-label="Quick actions">
      {CLIENT_WORKSPACE_QUICK_ACTIONS.map((action) => {
        const disabled = action.availability === 'disabled_future'
        const hintId = `crm-quick-action-${action.id}-hint`

        return (
          <div key={action.id} className="crm-client-workspace-quick-action-item">
            <button
              type="button"
              className="crm-secondary-btn crm-client-workspace-quick-action"
              disabled={disabled}
              title={disabled ? action.disabledReason : undefined}
              aria-describedby={disabled ? hintId : undefined}
              onClick={() => {
                if (disabled) return
                onAction(action.id)
              }}
            >
              {action.label}
            </button>
            {disabled && action.disabledReason ? (
              <p id={hintId} className="crm-client-workspace-quick-action-hint">
                {action.disabledReason}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
