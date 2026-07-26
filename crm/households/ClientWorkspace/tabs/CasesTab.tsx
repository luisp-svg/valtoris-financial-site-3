import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'

export default function CasesTab({ workspace }: ClientWorkspaceTabProps) {
  return (
    <div
      id="crm-client-workspace-tab-cases-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-cases"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-cases-heading">
        <SectionHeader
          title="Cases"
          titleId="crm-cases-heading"
          meta={<span className="crm-count-pill">{workspace.openCasesCount}</span>}
        />
        <EmptyState
          title="No open cases"
          description="There is no Cases table yet. This workspace slot is ready for the future Cases domain."
        />
      </Panel>
    </div>
  )
}
