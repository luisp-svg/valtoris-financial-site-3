import { useState } from 'react'
import MyDay from '../../crm/dashboard/MyDay'
import ExecutiveReportingStage1 from '../../crm/dashboard/ExecutiveReportingStage1'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../../crm/dashboard/dashboardHome.css'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import MetricStrip from '../../crm/dashboard/MetricStrip'
import NeedsAttentionSection from '../../crm/dashboard/NeedsAttentionSection'
import PipelineSnapshotSection from '../../crm/dashboard/PipelineSnapshotSection'
import ClientWorkflowGuide from '../../crm/dashboard/ClientWorkflowGuide'
import QuickActions from '../../crm/dashboard/QuickActions'
import RecentActivitySection from '../../crm/dashboard/RecentActivitySection'
import RecentHouseholdsSection from '../../crm/dashboard/RecentHouseholdsSection'
import TasksDueSection from '../../crm/dashboard/TasksDueSection'
import { useCrmDashboard } from '../../crm/dashboard/useCrmDashboard'
import OwnerOpsHome from '../../crm/ownerOps/OwnerOpsHome'
import OpportunityFormDialog from '../../crm/opportunities/OpportunityFormDialog'
import type { OpportunityDetail } from '../../crm/opportunities/types'
import { crmOpportunityPath } from '../../constants/routes'

function AdvisorCommandCenter() {

  const navigate = useNavigate()
  const {
    loading,
    data,
    attentionItems,
    attentionError,
    attentionWarning,
    tasksError,
    tasksWarning,
    reload,
  } = useCrmDashboard()
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)

  function onOpportunityCreated(opportunity: OpportunityDetail) {
    setShowCreateOpportunity(false)
    navigate(crmOpportunityPath(opportunity.id))
  }

  return (
    <div className="crm-home">
      <p className="crm-page-subtitle">Your pipeline and client activity</p>

      <div className="crm-dashboard-layout">
        <QuickActions onNewOpportunity={() => setShowCreateOpportunity(true)} />

        <NeedsAttentionSection
          items={attentionItems}
          loading={loading}
          error={attentionError}
          warning={attentionWarning}
          onRetry={reload}
        />


        <MetricStrip
          counts={data.statusCounts.value}
          loading={loading}
          error={data.statusCounts.ok ? null : 'Unable to load opportunity counts.'}
          onRetry={reload}
        />

        <div className="crm-home-grid">
          <TasksDueSection
            dueToday={data.tasksDueToday.value}
            overdue={data.overdueTasks.value}
            loading={loading}
            error={tasksError}
            warning={tasksWarning}
            onRetry={reload}
          />

          <PipelineSnapshotSection
            rows={data.stageSnapshot.value}
            loading={loading}
            error={data.stageSnapshot.ok ? null : 'Unable to load pipeline snapshot.'}
            onRetry={reload}
          />

          <RecentActivitySection
            items={data.recentActivities.value}
            loading={loading}
            error={data.recentActivities.ok ? null : 'Unable to load recent activity.'}
            onRetry={reload}
          />

          <RecentHouseholdsSection
            items={data.recentHouseholds.value}
            loading={loading}
            error={data.recentHouseholds.ok ? null : 'Unable to load recent households.'}
            onRetry={reload}
          />
        </div>
        <details className="tac-workflow-help"><summary>Client workflow guide</summary><ClientWorkflowGuide /></details>
      </div>

      {showCreateOpportunity ? (
        <OpportunityFormDialog
          mode="create"
          onCancel={() => setShowCreateOpportunity(false)}
          onSaved={onOpportunityCreated}
        />
      ) : null}
    </div>
  )
}

export default function CrmHomePage() {
  const { role, profile } = useCrmAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)
  const requestedView = params.get('view')
  const reporting = role === 'owner' && requestedView === 'reporting'
  const overview = !reporting && (requestedView === 'overview' || (requestedView !== 'day' && role === 'owner'))
  return <div className="tac-dashboard-home">
    <header className="crm-page-header">
      <div><p className="crm-page-eyebrow">Your agency workspace</p>
        <h1 className="crm-page-title">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p className="crm-page-subtitle">{role === 'owner' ? 'A clear view of your agency and your next steps.' : 'Your priorities, clients, and next steps in one place.'}</p>
      </div>
    </header>
    <nav className="tac-dashboard-views" aria-label="Dashboard views">
      {role === 'owner' ? <>
        <Link to="?view=overview" aria-current={overview ? 'page' : undefined}>Agency overview</Link>
        <Link to="?view=reporting" aria-current={reporting ? 'page' : undefined}>Executive reporting</Link>
        <Link to="?view=day" aria-current={!overview && !reporting ? 'page' : undefined}>My Day</Link>
      </> : <>
        <Link to="?view=day" aria-current={!overview && !reporting ? 'page' : undefined}>My Day</Link>
        <Link to="?view=overview" aria-current={overview ? 'page' : undefined}>Business overview</Link>
      </>}
    </nav>
    {reporting ? <ExecutiveReportingStage1 /> : overview ? (role === 'owner' ? <OwnerOpsHome /> : <AdvisorCommandCenter />) : <>
      <QuickActions onNewOpportunity={() => setShowCreateOpportunity(true)} />
      <MyDay />
      <details className="tac-workflow-help"><summary>Client workflow guide</summary><ClientWorkflowGuide /></details>
    </>}
    {showCreateOpportunity && <OpportunityFormDialog mode="create" onCancel={() => setShowCreateOpportunity(false)} onSaved={opportunity => {setShowCreateOpportunity(false);navigate(crmOpportunityPath(opportunity.id))}} />}
  </div>
}
