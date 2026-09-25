import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SavedHouseholdIntakes from './SavedHouseholdIntakes'
import Widget from '../components/ui/Widget'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import type { IntakeOrigin } from './intakeSource'
import { CLIENT_INTAKE_SERVICES, loadIntakeHubSources, loadIntakeHubStatus, type IntakeHubSource, type IntakeHubStatus } from './intakeHubApi'
export default function ClientIntakesWidget({ householdId }: { householdId: string }) {
  const [kind, setKind] = useState<IntakeOrigin['kind']>('member')
  const [page, setPage] = useState(0)
  const [sources, setSources] = useState<IntakeHubSource[] | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setSources(null); setSelected(''); setError('')
    void loadIntakeHubSources(createSupabaseBrowserClient(),householdId,kind,page).then(rows => {
      if (!cancelled) { setSources(rows); if (rows.length === 1) setSelected(rows[0].origin.id) }
    }).catch(() => { if (!cancelled) setError('Unable to load intake contacts. Please retry.') })
    return () => { cancelled = true }
  },[householdId,kind,page,revision])
  const source = sources?.find(s => s.origin.id === selected)
  return <Widget title="Client intakes" titleId="crm-widget-client-intakes" wide>
    <p>Start, resume, or review a service intake here. A report card is optional for existing contacts.</p>
    <SavedHouseholdIntakes key={householdId} householdId={householdId} />
    <h3>Choose a client record to start or review an intake</h3>
    <p>Status below applies only to the selected record. An intake started from another contact or report card is listed under Find a saved intake above.</p>
    <label className="crm-field">Record type <select value={kind} onChange={e => { setKind(e.target.value as IntakeOrigin['kind']); setPage(0); setSources(null); setSelected('') }}><option value="member">Household members</option><option value="contact">Existing contacts</option><option value="report_card">Completed report cards</option></select></label>
    {error ? <p role="alert">{error} <button onClick={() => setRevision(r => r + 1)}>Retry</button></p> : !sources ? <p role="status">Loading…</p> : <>
      {sources.length === 0 ? <p>No {kind === 'member' ? 'household members' : kind === 'contact' ? 'contacts' : 'completed report cards'} on this page. Check the other option for this household.</p> : <label className="crm-field">Client record <select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select the client record</option>{sources.map(s => <option key={s.origin.id} value={s.origin.id}>{s.label}</option>)}</select></label>}
      {source ? <IntakeServiceLinks key={`${source.origin.kind}:${source.origin.id}`} origin={source.origin} /> : null}
      {page > 0 || sources.length === 25 ? <div><button disabled={page===0} onClick={() => { setSelected(''); setSources(null); setPage(p => p-1) }}>Previous records</button>{' '}<button disabled={sources.length<25} onClick={() => { setSelected(''); setSources(null); setPage(p => p+1) }}>More records</button></div> : null}
    </>}
  </Widget>
}
function IntakeServiceLinks({ origin }: { origin: IntakeOrigin }) {
  const [statuses,setStatuses] = useState<IntakeHubStatus[] | null>(null)
  const [error,setError] = useState(false)
  const [revision,setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setStatuses(null);setError(false)
    void loadIntakeHubStatus(createSupabaseBrowserClient(),origin).then(rows => { if (!cancelled) setStatuses(rows) }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  },[origin,revision])
  if (error) return <p role="alert">Unable to load intake progress. <button onClick={() => setRevision(r => r+1)}>Retry</button></p>
  if (!statuses) return <p role="status">Loading intake progress…</p>
  return <div className="crm-dashboard-quick-action-row">{CLIENT_INTAKE_SERVICES.map(service => {
    const status = statuses.find(s => s.type===service.id)
    return <div key={service.id}><h3>{service.label}</h3><p>{status ? `${status.status === 'draft' ? 'Draft saved' : 'Completed'} · ${new Date(status.updatedAt).toLocaleDateString()}` : 'Not started for this record'}</p><Link className="crm-secondary-btn" to={service.path(origin)}>{status?.status==='draft' ? 'Resume intake' : status?.status==='completed' ? 'View intake' : 'Start intake'}</Link></div>
  })}</div>
}
