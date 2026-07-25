import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import MetricStrip from '../../crm/dashboard/MetricStrip'
import NeedsAttentionSection from '../../crm/dashboard/NeedsAttentionSection'
import PipelineSnapshotSection from '../../crm/dashboard/PipelineSnapshotSection'
import QuickActions from '../../crm/dashboard/QuickActions'
import RecentActivitySection from '../../crm/dashboard/RecentActivitySection'
import RecentHouseholdsSection from '../../crm/dashboard/RecentHouseholdsSection'
import TasksDueSection from '../../crm/dashboard/TasksDueSection'
import { useCrmDashboard } from '../../crm/dashboard/useCrmDashboard'
import OpportunityFormDialog from '../../crm/opportunities/OpportunityFormDialog'
import type { OpportunityDetail } from '../../crm/opportunities/types'
import { crmOpportunityPath } from '../../constants/routes'

export default function CrmHomePage() {
  const { email, role, profile } = useCrmAuth()
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
      <header className="crm-page-header crm-dashboard-header">
        <div>
          <p className="crm-page-eyebrow">CRM Home</p>
          <h1 className="crm-page-title">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="crm-page-subtitle">
            Signed in as {email}
            {role ? ` · ${role}` : ''}
            {' · '}
            What needs attention today
          </p>
        </div>
      </header>

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
