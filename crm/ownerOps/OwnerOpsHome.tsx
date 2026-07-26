import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrmAuth } from '../auth/CrmAuthContext'
import QuickActions from '../dashboard/QuickActions'
import RecentActivitySection from '../dashboard/RecentActivitySection'
import OpportunityFormDialog from '../opportunities/OpportunityFormDialog'
import type { OpportunityDetail } from '../opportunities/types'
import { crmOpportunityPath } from '../../constants/routes'
import AdvisorWorkloadSection from './AdvisorWorkloadSection'
import AgencySnapshotSection from './AgencySnapshotSection'
import OperationalAlertsSection from './OperationalAlertsSection'
import PipelineHealthSection from './PipelineHealthSection'
import { useOwnerOpsDashboard } from './useOwnerOpsDashboard'

export default function OwnerOpsHome() {
  const { email, role, profile } = useCrmAuth()
  const navigate = useNavigate()
  const { loading, data, reload } = useOwnerOpsDashboard(true)
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)

  function onOpportunityCreated(opportunity: OpportunityDetail) {
    setShowCreateOpportunity(false)
    navigate(crmOpportunityPath(opportunity.id))
  }

  return (
    <div className="crm-home crm-owner-ops">
      <header className="crm-page-header crm-dashboard-header">
        <div>
          <p className="crm-page-eyebrow">Agency Operations</p>
          <h1 className="crm-page-title">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="crm-page-subtitle">
            Signed in as {email}
            {role ? ` · ${role}` : ''}
            {' · '}
            Agency-wide pipeline and workload
          </p>
        </div>
      </header>

      <div className="crm-dashboard-layout">
        <QuickActions onNewOpportunity={() => setShowCreateOpportunity(true)} />

        <AgencySnapshotSection
          snapshot={data.snapshot.value}
          loading={loading}
          error={data.snapshot.ok ? null : 'Unable to load agency snapshot.'}
          onRetry={reload}
        />

        <div className="crm-home-grid">
          <PipelineHealthSection
            rows={data.stageHealth.value}
            snapshot={data.snapshot.value}
            loading={loading}
            error={data.stageHealth.ok ? null : 'Unable to load pipeline health.'}
            onRetry={reload}
          />

          <OperationalAlertsSection
            alerts={data.alerts.value}
            loading={loading}
            error={data.alerts.ok ? null : 'Unable to load operational alerts.'}
            onRetry={reload}
          />
        </div>

        <AdvisorWorkloadSection
          rows={data.workload.value}
          loading={loading}
          error={data.workload.ok ? null : 'Unable to load advisor workload.'}
          onRetry={reload}
        />

        <div className="crm-home-grid">
          <RecentActivitySection
            items={data.recentActivity.value}
            loading={loading}
            error={data.recentActivity.ok ? null : 'Unable to load recent activity.'}
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
