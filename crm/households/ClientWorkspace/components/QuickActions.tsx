import { CLIENT_WORKSPACE_QUICK_ACTIONS } from '../tabConfig'
import type { QuickActionId } from '../types'

type QuickActionsProps = { onAction: (actionId: QuickActionId) => void }

export default function QuickActions({ onAction }: QuickActionsProps) {
  return <div className="crm-client-workspace-quick-actions" aria-label="Quick actions">
    {CLIENT_WORKSPACE_QUICK_ACTIONS.filter(action => action.availability === 'enabled').map(action =>
      <button key={action.id} type="button" className="crm-secondary-btn crm-client-workspace-quick-action" onClick={() => onAction(action.id)}>{action.label}</button>,
    )}
  </div>
}
