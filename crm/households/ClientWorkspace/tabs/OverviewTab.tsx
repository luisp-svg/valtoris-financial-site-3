import OpportunityFormDialog from '../../../opportunities/OpportunityFormDialog'
import WidgetGrid from '../../../components/ui/WidgetGrid'
import OnboardingEntryWidget from '../../onboarding/OnboardingEntryWidget'
import CurrentOpportunitiesWidget from '../widgets/CurrentOpportunitiesWidget'
import FinancialProgressSummaryWidget from '../widgets/FinancialProgressSummaryWidget'
import HouseholdSummaryWidget from '../widgets/HouseholdSummaryWidget'
import HowWeMetWidget from '../widgets/HowWeMetWidget'
import InitialFinancialDiagnosticWidget from '../widgets/InitialFinancialDiagnosticWidget'
import OpenCasesWidget from '../widgets/OpenCasesWidget'
import RecentDocumentsWidget from '../widgets/RecentDocumentsWidget'
import RecentTimelineWidget from '../widgets/RecentTimelineWidget'
import UpcomingTasksWidget from '../widgets/UpcomingTasksWidget'
import type {
  ClientWorkspaceOpportunityHandlers,
  ClientWorkspaceTabProps,
} from '../types'

type OverviewTabProps = ClientWorkspaceTabProps & ClientWorkspaceOpportunityHandlers

export default function OverviewTab({
  workspace,
  householdId,
  onNavigateTab,
  showCreateOpportunity,
  onOpenCreateOpportunity,
  onCancelCreateOpportunity,
  onOpportunityCreated,
}: OverviewTabProps) {
  return (
    <div
      id="crm-client-workspace-tab-overview-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-overview"
      className="crm-household-workspace-tab-panel"
    >
      {showCreateOpportunity ? (
        <OpportunityFormDialog
          mode="create"
          defaultHouseholdId={householdId}
          onCancel={onCancelCreateOpportunity}
          onSaved={onOpportunityCreated}
        />
      ) : null}

      <WidgetGrid>
        <HouseholdSummaryWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <HowWeMetWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <OnboardingEntryWidget householdId={householdId} />
        <InitialFinancialDiagnosticWidget workspace={workspace} householdId={householdId} />
        <FinancialProgressSummaryWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <CurrentOpportunitiesWidget
          workspace={workspace}
          onCreateOpportunity={onOpenCreateOpportunity}
        />
        <OpenCasesWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <UpcomingTasksWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <RecentDocumentsWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <RecentTimelineWidget workspace={workspace} onNavigateTab={onNavigateTab} />
      </WidgetGrid>
    </div>
  )
}
