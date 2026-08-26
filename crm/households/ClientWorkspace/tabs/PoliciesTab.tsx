import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import { fetchHouseholdPolicyBook } from '../../householdPoliciesApi'
import type { HouseholdPolicyCard } from '../../householdPoliciesView'
import { VIEW_CASE_LABEL } from '../../../production/policyHandoffView'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import type { ClientWorkspaceTabProps } from '../types'

function PolicyCard({ policy }: { policy: HouseholdPolicyCard }) {
  return (
    <li className="crm-household-case-card crm-household-policy-card">
      <h3 className="crm-household-case-product">
        {policy.carrier} · {policy.product}
      </h3>
      <p className="crm-household-case-stage">Policy {policy.statusLabel}</p>
      <p className="crm-task-meta">Policy {policy.policyNumberDisplay}</p>
      {policy.insuredLine ? <p className="crm-task-meta">{policy.insuredLine}</p> : null}
      {policy.ownerLine ? <p className="crm-task-meta">{policy.ownerLine}</p> : null}
      {policy.moneyLines.map((line) => (
        <p key={line} className="crm-household-case-amount">
          {line}
        </p>
      ))}
      {policy.effectiveDateLine ? <p className="crm-task-meta">{policy.effectiveDateLine}</p> : null}
      {policy.writingAdvisorsLine ? (
        <p className="crm-task-meta">Writing {policy.writingAdvisorsLine}</p>
      ) : null}
      {policy.servicingAdvisorLine ? (
        <p className="crm-task-meta">{policy.servicingAdvisorLine}</p>
      ) : null}
      {policy.terminationLine ? <p className="crm-task-meta">{policy.terminationLine}</p> : null}
      {policy.viewCaseHref ? (
        <Link to={policy.viewCaseHref} className="crm-text-btn">
          {VIEW_CASE_LABEL}
        </Link>
      ) : null}
    </li>
  )
}

export default function PoliciesTab({ householdId }: ClientWorkspaceTabProps) {
  const [rows, setRows] = useState<HouseholdPolicyCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const policies = await fetchHouseholdPolicyBook(
          createSupabaseBrowserClient(),
          householdId,
        )
        if (cancelled) return
        setRows(policies)
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
      className="crm-client-workspace-tab-panel"
    >
      <Panel labelledBy="crm-policies-heading">
        <SectionHeader
          title="Policies"
          titleId="crm-policies-heading"
          meta={<span className="crm-count-pill">{loading ? '…' : rows.length}</span>}
        />
        <p className="crm-muted">
          Policy records for this household, including issued, in force, canceled, surrendered, and
          imported history. This is not the active-protection count.
        </p>
        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="crm-muted">Loading policies…</p> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No policies"
            description="Issued, in-force, and historical policy records for this household will appear here."
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="crm-household-overview-list crm-client-policies-list">
            {rows.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  )
}
