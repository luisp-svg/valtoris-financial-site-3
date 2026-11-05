import ClientIntakesWidget from '../../../serviceIntakes/ClientIntakesWidget'
import HouseholdRecordsWidget from '../../../archive/HouseholdRecordsWidget'
import InsuranceQuotesWidget from '../widgets/InsuranceQuotesWidget'
import OpportunityFormDialog from '../../../opportunities/OpportunityFormDialog'
import DeferredSection from '../components/DeferredSection'
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

      <p className="tac-household-overview-intro">Start with the next task or an active opportunity. Open a section below for reports, intake, and supporting records.</p>
      <WidgetGrid>
        <UpcomingTasksWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <CurrentOpportunitiesWidget workspace={workspace} onCreateOpportunity={onOpenCreateOpportunity} />
        {workspace.openCasesCount > 0 && <OpenCasesWidget workspace={workspace} onNavigateTab={onNavigateTab} />}
      </WidgetGrid>
      <DeferredSection key={householdId + ":Reports & client intake"} title="Reports & client intake"><WidgetGrid>
        <ClientIntakesWidget key={householdId} householdId={householdId} />
        <InitialFinancialDiagnosticWidget workspace={workspace} householdId={householdId} />
        <FinancialProgressSummaryWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <OnboardingEntryWidget householdId={householdId} />
      </WidgetGrid></DeferredSection>
      <DeferredSection key={householdId + ":Quotes & recent documents"} title="Quotes & recent documents"><WidgetGrid>
        <InsuranceQuotesWidget key={householdId} householdId={householdId} />
        <RecentDocumentsWidget workspace={workspace} onNavigateTab={onNavigateTab} />
      </WidgetGrid></DeferredSection>
      <DeferredSection key={householdId + ":Household background"} title="Household background"><WidgetGrid>
        <HouseholdSummaryWidget workspace={workspace} onNavigateTab={onNavigateTab} />
        <HowWeMetWidget workspace={workspace} onNavigateTab={onNavigateTab} />
      </WidgetGrid></DeferredSection>
      <DeferredSection key={householdId + ":Recent activity"} title="Recent activity">
        <RecentTimelineWidget workspace={workspace} onNavigateTab={onNavigateTab} />
      </DeferredSection>
      <DeferredSection key={householdId + ":Linked contacts & record history"} title="Linked contacts & record history">
        <HouseholdRecordsWidget key={householdId} householdId={householdId} />
      </DeferredSection>

    </div>
  )
}
