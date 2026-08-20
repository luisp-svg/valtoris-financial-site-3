import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../../../constants/routes'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import { mapHouseholdProductionPolicy } from '../../../production/householdProductionView'
import { fetchHouseholdProductionApplications } from '../../../production/productionApi'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import type { ClientWorkspaceTabProps } from '../types'
import { formatWorkspaceDate } from '../format'

export default function PoliciesTab({ workspace, householdId }: ClientWorkspaceTabProps) {
  const legacyPolicies = workspace.activePolicies
  const [rows, setRows] = useState<ReturnType<typeof mapHouseholdProductionPolicy>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const applications = await fetchHouseholdProductionApplications(
          createSupabaseBrowserClient(),
          householdId,
        )
        if (cancelled) return
        setRows(applications.map(mapHouseholdProductionPolicy))
      } catch {
        if (!cancelled) {
          setRows([])
          setError('Unable to load policies for this client.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId])

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
          meta={<span className="crm-count-pill">{loading ? '…' : rows.length}</span>}
        />
        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="crm-muted">Loading policies…</p> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No production policies"
            description="Policies linked to this household through Policy Production will appear here."
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="crm-household-overview-list crm-client-policies-list">
            {rows.map((policy) => (
              <li key={policy.id} className="crm-household-case-card crm-household-policy-card">
                <h3 className="crm-household-case-product">
                  {policy.carrier} · {policy.product}
                </h3>
                <p className="crm-household-case-stage">
                  {policy.productLine}
                  {policy.policyLifecycleLabel
                    ? ` · ${policy.policyLifecycleLabel}`
                    : ` · ${policy.stage}`}
                </p>
                <p className="crm-household-case-amount">{policy.premiumDisplay}</p>
                <p className="crm-task-meta">
                  Policy {policy.policyNumberDisplay}
                  {policy.applicationNumber && !policy.policyNumberDisplay.startsWith('Application ')
                    ? ` · Application ${policy.applicationNumber}`
                    : ''}
                </p>
                <p className="crm-task-meta">{policy.roles}</p>
                <p className="crm-task-meta">
                  Writing {policy.writingAdvisors} · {policy.dates}
                </p>
                <Link to={crmProductionPath(policy.id)} className="crm-text-btn">
                  Open in Production
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      {legacyPolicies.length > 0 ? (
        <Panel labelledBy="crm-legacy-policies-heading">
          <SectionHeader
            title="Legacy policy records"
            titleId="crm-legacy-policies-heading"
            meta={<span className="crm-count-pill">{legacyPolicies.length}</span>}
          />
          <p className="crm-muted">
            Older household policy rows that are not linked through Policy Production.
          </p>
          <ul className="crm-household-overview-list">
            {legacyPolicies.map((policy) => (
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
        </Panel>
      ) : null}
    </div>
  )
}
