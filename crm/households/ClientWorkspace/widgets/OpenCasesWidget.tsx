import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { CrmHouseholdWorkspace } from '../../types'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function OpenCasesWidget({ workspace, onNavigateTab }: Props) {
  return (
    <Widget
      title="Open Cases"
      titleId="crm-widget-open-cases"
      meta={<span className="crm-count-pill">{workspace.openCasesCount}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={() => onNavigateTab('cases')}>
          View cases
        </button>
      }
    >
      <EmptyState
        title="No open cases"
        description="Cases will appear here when the Cases domain is available."
      />
    </Widget>
  )
}
