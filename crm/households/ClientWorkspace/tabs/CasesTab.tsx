import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { crmOpportunityPath, crmProductionPath } from '../../../../constants/routes'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import CaseAttentionFlagList from '../../../production/CaseAttentionFlagList'
import { partitionHouseholdCases, type HouseholdCaseRow } from '../../../production/householdCasesView'
import { fetchHouseholdProductionApplications } from '../../../production/productionApi'
import { fetchOverdueRequirementCountsByApplicationIds } from '../../../production/requirementApi'
import { applyOverdueRequirementCounts } from '../../../production/requirementView'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import type { ClientWorkspaceTabProps } from '../types'

function CaseRow({ row }: { row: HouseholdCaseRow }) {
  return (
    <li className="crm-household-case-card">
      <h3 className="crm-household-case-product">
        {row.carrier} · {row.product}
      </h3>
      <p className="crm-household-case-stage">
        {row.productLine} · {row.lifecycleBadge ?? row.stage}
      </p>
      <CaseAttentionFlagList labels={row.attentionLabels} />
      <p className="crm-household-case-amount">{row.amount}</p>
      <p className="crm-task-meta">
        Submitted {row.submitted}
        {row.followUp ? ` · Follow-up ${row.followUp}` : ''}
        {row.applicationNumber ? ` · App ${row.applicationNumber}` : ''}
        {row.policyNumber ? ` · Policy ${row.policyNumber}` : ''}
      </p>
      <p className="crm-task-meta">
        {row.insuredOrAnnuitant} · Writing {row.writingAdvisors}
        {row.daysInStage != null ? ` · ${row.daysInStage} days in stage` : ''}
      </p>
      <Link to={crmProductionPath(row.id)} className="crm-text-btn">
        Open case workspace
      </Link>
      {row.opportunityId ? (
        <Link to={crmOpportunityPath(row.opportunityId)} className="crm-text-btn">
          Opportunity
        </Link>
      ) : null}
    </li>
  )
}

export default function CasesTab({ workspace, householdId }: ClientWorkspaceTabProps) {
  const [openRows, setOpenRows] = useState<HouseholdCaseRow[]>([])
  const [closedRows, setClosedRows] = useState<HouseholdCaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const applications = await fetchHouseholdProductionApplications(supabase, householdId)
        if (cancelled) return
        let overdueCounts = new Map<string, number>()
        try {
          overdueCounts = await fetchOverdueRequirementCountsByApplicationIds(
            supabase,
            applications.map((application) => application.id),
          )
        } catch {
          overdueCounts = new Map()
        }
        if (cancelled) return
        const { open, closed } = partitionHouseholdCases(
          applyOverdueRequirementCounts(applications, overdueCounts),
        )
        setOpenRows(open)
        setClosedRows(closed)
      } catch {
        if (!cancelled) {
          setOpenRows([])
          setClosedRows([])
          setError('Unable to load cases for this client.')
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
      id="crm-client-workspace-tab-cases-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-cases"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-cases-heading">
        <SectionHeader
          title="Open cases"
          titleId="crm-cases-heading"
          meta={<span className="crm-count-pill">{loading ? workspace.openCasesCount : openRows.length}</span>}
        />
        <p className="crm-muted">
          Operational Life and FIA cases. Issued stays open until in force. This is not the
          Policies tab. Requirement details stay on the Case workspace.
        </p>
        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="crm-muted">Loading cases…</p> : null}
        {!loading && openRows.length === 0 ? (
          <EmptyState
            title="No open cases"
            description="Submitted Life and FIA cases in underwriting, client action, or delivery/funding will appear here."
          />
        ) : null}
        {!loading && openRows.length > 0 ? (
          <ul className="crm-household-overview-list crm-household-cases-list">
            {openRows.map((row) => (
              <CaseRow key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel labelledBy="crm-closed-cases-heading">
        <SectionHeader
          title="Closed / historical cases"
          titleId="crm-closed-cases-heading"
          meta={<span className="crm-count-pill">{loading ? '…' : closedRows.length}</span>}
        />
        <p className="crm-muted">
          In force, declined, withdrawn, incomplete, and not taken. Issued policies also appear on
          the Policies tab.
        </p>
        {!loading && closedRows.length === 0 ? (
          <EmptyState
            title="No closed cases"
            description="Placed and terminated cases for this household will appear here."
          />
        ) : null}
        {!loading && closedRows.length > 0 ? (
          <ul className="crm-household-overview-list crm-household-cases-list">
            {closedRows.map((row) => (
              <CaseRow key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  )
}
