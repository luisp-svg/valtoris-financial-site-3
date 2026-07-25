import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'

type Props = {
  onNewOpportunity: () => void
}

export default function QuickActions({ onNewOpportunity }: Props) {
  return (
    <section className="crm-dashboard-quick-actions" aria-label="Quick actions">
      <div className="crm-panel-head">
        <h2>Quick Actions</h2>
      </div>
      <div className="crm-dashboard-quick-action-row">
        <button type="button" className="crm-primary-btn" onClick={onNewOpportunity}>
          New Opportunity
        </button>
        <Link to={ROUTES.crmTasks} className="crm-secondary-btn">
          Add Task
        </Link>
      </div>
    </section>
  )
}
