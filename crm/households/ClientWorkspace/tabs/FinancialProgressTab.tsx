import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'

export default function FinancialProgressTab({ workspace }: ClientWorkspaceTabProps) {
  const { financialProgress } = workspace

  return (
    <div
      id="crm-client-workspace-tab-financial_progress-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-financial_progress"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-financial-progress-heading">
        <SectionHeader title="Financial Progress" titleId="crm-financial-progress-heading" />
        <EmptyState
          title="Financial Progress Engine not connected"
          description={
            <>
              This tab is a placeholder for the future scoring engine. Current status:{' '}
              <strong>{financialProgress.label}</strong>.
            </>
          }
        />
      </Panel>
    </div>
  )
}
