import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { CrmHouseholdWorkspace } from '../../types'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function OpenCasesWidget({ workspace, onNavigateTab }: Props) {
  const count = workspace.openCasesCount
  return (
    <Widget
      title="Open Cases"
      titleId="crm-widget-open-cases"
      meta={<span className="crm-count-pill">{count}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={() => onNavigateTab('cases')}>
          View cases
        </button>
      }
    >
      {count === 0 ? (
        <EmptyState
          title="No open cases"
          description="Submitted Life and FIA applications still in pipeline will appear here."
        />
      ) : (
        <p className="crm-muted">
          {count === 1
            ? '1 open Life or FIA application needs operational follow-through.'
            : `${count} open Life or FIA applications need operational follow-through.`}
        </p>
      )}
    </Widget>
  )
}
