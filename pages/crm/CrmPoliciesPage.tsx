import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { crmHouseholdPoliciesPath, crmProductionPath } from '../../constants/routes'
import { fetchPolicyDirectory, filterPolicyDirectory, type DirectoryPolicy } from '../../crm/households/policyDirectoryApi'
import { formatHouseholdPolicyStatus } from '../../crm/households/householdPoliciesView'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import '../../crm/relaunch/relaunch.css'

const PAGE_SIZE = 50
export default function CrmPoliciesPage() {
  const [rows, setRows] = useState<DirectoryPolicy[]>([])
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [carrier, setCarrier] = useState(''), [page, setPage] = useState(1)
  useEffect(() => {
    let cancelled = false
    setBusy(true); setError('')
    void fetchPolicyDirectory(createSupabaseBrowserClient()).then(result => {
      if (!cancelled) setRows(result)
    }).catch(() => {
      if (!cancelled) { setRows([]); setError('Policies could not be loaded. Try refreshing the policy book.') }
    }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [refresh])
  const matching = useMemo(() => filterPolicyDirectory(rows, search, status, carrier), [rows, search, status, carrier])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matching.length / PAGE_SIZE)))
  const visible = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const statuses = [...new Set(rows.map(row => row.status).filter(Boolean))].sort()
  const carriers = [...new Set(rows.map(row => row.carrier).filter(Boolean))].sort()
  return <div className="crm-page tac-workspace">
    <h1>Policy book</h1>
    <p>Policy records you can access, including issued, in-force and historical coverage. Applications still in progress are tracked in <Link to="/crm/production">Production</Link>.</p>
    <div className="tac-filters">
      <label>Search policies<input type="search" value={search} placeholder="Client, policy number, carrier or product" onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{formatHouseholdPolicyStatus(value)}</option>)}</select></label>
      <label>Carrier<select value={carrier} onChange={event => { setCarrier(event.target.value); setPage(1) }}><option value="">All carriers</option>{carriers.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" style={{ minHeight: 44 }} disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh policy book</button>
    </div>
    {busy && <p role="status">Loading policies…</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && <>
      <nav aria-label="Policy book pages">
        <p role="status">{matching.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, matching.length)} of ${matching.length} policies` : 'No policies match this view.'}</p>
        <button type="button" style={{ minHeight: 44 }} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>{' '}
        <button type="button" style={{ minHeight: 44 }} disabled={currentPage * PAGE_SIZE >= matching.length} onClick={() => setPage(currentPage + 1)}>Next</button>
      </nav>
      {visible.map(policy => <article className="tac-row" key={policy.id}>
        <h2>{policy.carrier || 'Carrier not recorded'} · {policy.policy_type || 'Product not recorded'}</h2>
        <p><Link to={crmHouseholdPoliciesPath(policy.household_id)}>{policy.household?.display_name || 'Client workspace'}</Link></p>
        <p>Policy {policy.policy_number || 'number not recorded'} · {formatHouseholdPolicyStatus(policy.status)}</p>
        <p>{policy.effective_date ? `Effective ${policy.effective_date}` : 'Effective date not recorded'}</p>
        {policy.source_application_id && <Link className="crm-text-btn" to={crmProductionPath(policy.source_application_id)}>View application</Link>}
      </article>)}
    </>}
  </div>
}
