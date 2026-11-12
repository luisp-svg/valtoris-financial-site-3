import LicensingBoard from '../../crm/recruiting/LicensingBoard'
import { licenseDateLabel as formatDateLabel } from '../../crm/recruiting/licenseDates'
import { localDateString } from '../../crm/dashboard/dates'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { licensingEvidence, listRecruits, recruitCommand, recruitOptions, recruitingError, recruitingManager } from '../../crm/recruiting/api'
import { RECRUIT_STAGES, LICENSE_TYPES, APPOINTING_ORGANIZATIONS, licenseTypeLabel, appointingOrganizationsLabel, appointingOrganizations, stageLabel, type Option, type Recruit } from '../../crm/recruiting/types'
import { ATTENTION_FILTERS, licensingSummary, matchesAttention, type AttentionFilter } from '../../crm/recruiting/licensingView'
import RecruitForm from '../../crm/recruiting/RecruitForm'
import { createFields } from '../../crm/recruiting/formFields'
import '../../crm/recruiting/recruiting.css'
type Evidence = Awaited<ReturnType<typeof licensingEvidence>>
export default function CrmRecruitingPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<Recruit[]>([])
  const [evidence, setEvidence] = useState<Evidence>({ credentials: [], carriers: [] })
  const [manager, setManager] = useState(false), [advisors, setAdvisors] = useState<Option[]>([])
  const [carrierOptions, setCarrierOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false), [reload, setReload] = useState(0)
  const [layout,setLayout]=useState<'board'|'list'>('board')
  const [search, setSearch] = useState(''), [stage, setStage] = useState(''), [archived, setArchived] = useState(false)
  const [advisor, setAdvisor] = useState(''), [state, setState] = useState(''), [carrier, setCarrier] = useState('')
  const [licenseType, setLicenseType] = useState(''), [organization, setOrganization] = useState('')
  const [attention, setAttention] = useState<AttentionFilter>('all')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    ;(async () => {
      try {
        const db = createSupabaseBrowserClient()
        const canManage = await recruitingManager(db)
        const [rows, options, requirements] = await Promise.all([
          listRecruits(db), canManage ? recruitOptions(db) : Promise.resolve({ advisors: [], carriers: [] }), licensingEvidence(db),
        ])
        if (active) { setManager(canManage); setRecords(rows); setAdvisors(options.advisors); setCarrierOptions(options.carriers); setEvidence(requirements) }
      } catch (e) {
        if (active) { setRecords([]); setManager(false); setEvidence({ credentials: [], carriers: [] }); setError(recruitingError(e)) }
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [reload])
  const today = localDateString()
  const summaries = useMemo(() => records.map(record => ({ record, summary: licensingSummary(record, evidence.credentials, evidence.carriers, today) })), [records, evidence, today])
  const states = [...new Set(summaries.flatMap(row => row.summary.states))].sort()
  const scoped = summaries.filter(({ record: r, summary: s }) => r.is_archived === archived && (!licenseType || r.license_types?.includes(licenseType)) && (!organization || appointingOrganizations(r).includes(organization)) && (!stage || r.stage === stage) && (!advisor || r.assigned_advisor_id === advisor) && (!state || s.states.includes(state)) && (!carrier || s.carriers.some(c => c.carrier_id === carrier)) && `${r.full_name} ${r.email} ${r.phone ?? ''} ${r.contract_level ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const visible = scoped.filter(({ record, summary }) => matchesAttention(record, summary, attention))
    .sort((a, b) => (a.record.next_action_due_on || '9999').localeCompare(b.record.next_action_due_on || '9999') || a.record.full_name.localeCompare(b.record.full_name))
  async function create(values: Record<string, unknown>, reason: string) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const id = await recruitCommand(createSupabaseBrowserClient(), null, 'create', values, reason)
      navigate(`/crm/recruiting/${id}`)
    } catch (e) { setError(recruitingError(e)) } finally { setBusy(false) }
  }
  return <div className="recruiting-page">
    <header className="crm-page-header"><div><p className="crm-page-eyebrow">Agent management</p><h1 className="crm-page-title">Licensing &amp; Appointments</h1><p className="crm-page-subtitle">Manage every agent’s licenses, E&amp;O, carrier contracting, and carrier statuses.</p></div>{manager && !loading ? <button className="crm-primary-btn" disabled={creating} onClick={() => setCreating(true)}>Add agent</button> : null}</header>
    {error ? <p role="alert" className="crm-banner crm-banner-error">{error}</p> : null}
    {creating && manager ? <RecruitForm title="Add agent" description="Add a new or already licensed agent. Save their contact details first, then add licenses, E&O, and carrier appointments in their record. This creates a tracking record without creating a login." submitLabel="Save agent and open record" changeReason="Agent added through the Licensing & Appointments workspace." fields={createFields(advisors)} busy={busy} onCancel={() => setCreating(false)} onSubmit={create} /> : null}
    <section className="crm-panel" aria-label="Filter agents"><div className="recruit-fields">
      <label className="crm-field">Search agents<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone, or contract level" /></label>
      <label className="crm-field">License type<select value={licenseType} onChange={e => setLicenseType(e.target.value)}><option value="">All license types</option>{LICENSE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="crm-field">Appointing under<select value={organization} onChange={e => setOrganization(e.target.value)}><option value="">All organizations</option>{APPOINTING_ORGANIZATIONS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className="crm-field">Workflow stage<select value={stage} onChange={e => setStage(e.target.value)}><option value="">All stages</option>{RECRUIT_STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}</select></label>
      <label className="crm-field">State<select value={state} onChange={e => setState(e.target.value)}><option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select></label>
      {manager ? <><label className="crm-field">Carrier<select value={carrier} onChange={e => setCarrier(e.target.value)}><option value="">All carriers</option>{carrierOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="crm-field">Assigned advisor<select value={advisor} onChange={e => setAdvisor(e.target.value)}><option value="">All advisors</option>{advisors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="crm-field">Archived agents<input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /></label></> : null}
    </div><div className="recruit-actions"><button className="crm-text-btn" disabled={loading || busy || creating} onClick={() => setReload(v => v + 1)}>Refresh</button><button className="crm-text-btn" onClick={() => { setSearch(''); setStage(''); setState(''); setCarrier(''); setAdvisor(''); setAttention('all'); setArchived(false); setLicenseType(''); setOrganization('') }}>Clear filters</button></div></section>
    {loading ? <p role="status">Loading agent licensing records…</p> : null}
    {!loading && !error ? <>
      <section className="license-summary" aria-label="Agent attention filters">{ATTENTION_FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={attention === key} className="crm-panel license-summary-card" onClick={() => setAttention(key)}><strong>{scoped.filter(({ record, summary }) => matchesAttention(record, summary, key)).length}</strong><span>{label}</span></button>)}</section>
      <p className="crm-muted">{visible.length} agent{visible.length === 1 ? '' : 's'} shown. Counts reflect the filters above. Readiness is reviewed separately for each carrier, state, and license scope.</p>
      {visible.length === 0 ? <section className="crm-panel"><p>{manager ? 'No agents match this view. Add an agent or adjust the filters.' : 'No matching agent record is linked to your account.'}</p>{manager ? <button type="button" className="crm-primary-btn" disabled={creating} onClick={() => setCreating(true)}>Add agent</button> : null}</section> : null}
      <div className="tac-board-layout-toggle" aria-label="Licensing layout"><button type="button" className="crm-secondary-btn" aria-pressed={layout==='board'} onClick={()=>setLayout('board')}>Board</button><button type="button" className="crm-secondary-btn" aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>List</button></div>
      {layout==='board'&&<LicensingBoard records={visible.map(row=>row.record)} canManage={manager&&!archived} onChanged={()=>setReload(value=>value+1)}/>}
      {layout==='list'&&<section aria-label="Agent licensing records" className="recruit-list">{visible.map(({ record: r, summary: s }) => <article className="crm-panel license-agent-card" key={r.id}>
        <div><p className="crm-page-eyebrow">{stageLabel(r.stage)}</p><h2><Link to={`/crm/recruiting/${r.id}`}>{r.full_name}</Link></h2><p>{r.email}</p></div>
        <p><strong>License types:</strong> {r.license_types?.map(licenseTypeLabel).join(', ') || 'Not recorded'}</p>
        <p><strong>Appointing under:</strong> {appointingOrganizationsLabel(r)}</p>
        <p><strong>Contract level:</strong> {r.contract_level || 'Not recorded'}</p>
        <p>States: {s.states.join(', ') || 'Not recorded'}</p>
        <dl className="license-agent-counts"><div><dt>Licenses</dt><dd>{s.credentials.filter(c => c.kind === 'license').length}</dd></div><div><dt>Carrier reviews</dt><dd>{s.carriers.length}</dd></div><div><dt>Appointments pending</dt><dd>{s.pendingAppointments}</dd></div></dl>
        <ul className="license-attention-list">
          {s.licenseMissing ? <li>License evidence needed</li> : null}{s.eoMissing ? <li>E&amp;O evidence needed</li> : null}{s.carrierMissing ? <li>Carrier review needed</li> : null}
          {s.pendingContracts > 0 ? <li>{s.pendingContracts} contracting record{s.pendingContracts === 1 ? '' : 's'} pending</li> : null}
          {s.credentialsToReview.length > 0 ? <li>{s.credentialsToReview.length} credential record{s.credentialsToReview.length === 1 ? '' : 's'} to review</li> : null}
          {s.reviewsNeeded.length > 0 ? <li>{s.reviewsNeeded.length} carrier scope{s.reviewsNeeded.length === 1 ? '' : 's'} with requirements to review</li> : null}
        </ul>
        {s.expired.length > 0 ? <p className="crm-banner crm-banner-error">{s.expired.length} expired record{s.expired.length === 1 ? '' : 's'} — earliest: {s.expired[0].label}, {formatDateLabel(s.expired[0].date)}</p> : null}
        {s.renewals.length > 0 ? <p className="license-renewal">{s.renewals.length} renewal{s.renewals.length === 1 ? '' : 's'} within 60 days — next: {s.renewals[0].label}, {formatDateLabel(s.renewals[0].date)}</p> : null}

        <Link className="crm-secondary-btn" to={`/crm/recruiting/${r.id}`}>Manage agent</Link>
      </article>)}</section>}
    </> : null}
  </div>
}
