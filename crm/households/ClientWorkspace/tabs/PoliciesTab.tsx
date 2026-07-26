import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'
import { formatWorkspaceDate } from '../format'

export default function PoliciesTab({ workspace }: ClientWorkspaceTabProps) {
  const policies = workspace.activePolicies

  return (
    <div
      id="crm-client-workspace-tab-policies-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-policies"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-policies-heading">
        <SectionHeader
          title="Policies"
          titleId="crm-policies-heading"
          meta={<span className="crm-count-pill">{policies.length}</span>}
        />
        {policies.length === 0 ? (
          <EmptyState
            title="No active policies"
            description="Active policies for this household will appear here. Policy management is not enabled in this sprint."
          />
        ) : (
          <ul className="crm-household-overview-list">
            {policies.map((policy) => (
              <li key={policy.id}>
                <p className="crm-task-title">
                  {policy.carrier} · {policy.policy_type}
                </p>
                <p className="crm-task-meta">
                  {policy.status.replace(/_/g, ' ')}
                  {policy.renewal_or_review_date
                    ? ` · Review ${formatWorkspaceDate(policy.renewal_or_review_date)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
