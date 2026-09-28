import { localDateString } from '../../crm/dashboard/dates'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { listRecruits, recruitCommand, recruitOptions, recruitingError, recruitingManager } from '../../crm/recruiting/api'
import { RECRUIT_STAGES, stageLabel, type Option, type Recruit } from '../../crm/recruiting/types'
import RecruitForm from '../../crm/recruiting/RecruitForm'
import { createFields } from '../../crm/recruiting/formFields'
import '../../crm/recruiting/recruiting.css'
export default function CrmRecruitingPage() {
  const [records, setRecords] = useState<Recruit[]>([]), [manager, setManager] = useState(false), [advisors, setAdvisors] = useState<Option[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [creating, setCreating] = useState(false), [reload, setReload] = useState(0)
  const [search, setSearch] = useState(''), [stage, setStage] = useState(''), [archived, setArchived] = useState(false), [advisor, setAdvisor] = useState('')
  useEffect(() => { let active = true; setLoading(true); setError('')
    ;(async () => { try { const db = createSupabaseBrowserClient(); const canManage = await recruitingManager(db); const [rows, options] = await Promise.all([listRecruits(db), canManage ? recruitOptions(db) : Promise.resolve({ advisors: [], carriers: [] })]); if (active) { setManager(canManage); setRecords(rows); setAdvisors(options.advisors) } } catch (e) { if (active) { setRecords([]); setManager(false); setError(recruitingError(e)) } } finally { if (active) setLoading(false) } })()
    return () => { active = false }
  }, [reload])
  const visible = useMemo(() => records.filter(r => r.is_archived === archived && (!stage || r.stage === stage) && (!advisor || r.assigned_advisor_id === advisor) && `${r.full_name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase())), [records, archived, stage, advisor, search])
  async function create(values: Record<string, unknown>, reason: string) { setBusy(true); setError(''); try { const id = await recruitCommand(createSupabaseBrowserClient(), null, 'create', values, reason); setCreating(false); setReload(v => v + 1); setCreatedId(id) } catch (e) { setError(recruitingError(e)) } finally { setBusy(false) } }
  const [createdId, setCreatedId] = useState('')
  return <div className="recruiting-page">
    <header className="crm-page-header"><div><p className="crm-page-eyebrow">Advisor onboarding</p><h1 className="crm-page-title">Recruiting</h1><p className="crm-page-subtitle">Track recruiting progress, credentials, contracting, and carrier readiness.</p></div>{manager && !loading ? <button className="crm-primary-btn" disabled={creating} onClick={() => { setCreating(true); setCreatedId('') }}>Add recruit</button> : null}</header>
    {error ? <p role="alert" className="crm-banner crm-banner-error">{error}</p> : null}
    {createdId ? <p className="crm-banner crm-banner-success">Recruit created. <Link to={`/crm/recruiting/${createdId}`}>Open onboarding record</Link></p> : null}
    {creating && manager ? <RecruitForm title="Add recruit" fields={createFields(advisors)} busy={busy} onCancel={() => setCreating(false)} onSubmit={create} /> : null}
    <section className="crm-panel"><div className="recruit-fields">
      <label className="crm-field">Search<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" /></label>
      <label className="crm-field">Stage<select value={stage} onChange={e => setStage(e.target.value)}><option value="">All stages</option>{RECRUIT_STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}</select></label>
      {manager ? <><label className="crm-field">Recruiting advisor<select value={advisor} onChange={e => setAdvisor(e.target.value)}><option value="">All advisors</option>{advisors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="crm-field">Archived records<input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /></label></> : null}
    </div><button className="crm-text-btn" disabled={loading || busy} onClick={() => setReload(v => v + 1)}>Refresh</button></section>
    {loading ? <p>Loading recruiting…</p> : !error && visible.length === 0 ? <section className="crm-panel"><p>{manager ? 'No recruits match this view.' : 'No onboarding record is linked to your account.'}</p></section> : null}
    {!loading && !error ? <section aria-label="Recruiting records" className="recruit-list">{visible.map(r => <article className="crm-panel" key={r.id}>
      <h2><Link to={`/crm/recruiting/${r.id}`}>{r.full_name}</Link></h2><p>{r.email}</p><p><strong>{stageLabel(r.stage)}</strong></p>
      <p>Next action: {r.next_action || 'Not set'}</p><p>Follow-up: {r.next_action_due_on || 'No date'}</p>
      {r.next_action_due_on && r.next_action_due_on < localDateString() ? <p className="crm-banner crm-banner-error">Follow-up overdue</p> : null}
      {['ready_to_write','active_agent'].includes(r.stage) ? <p className="crm-muted">Open the record to check current readiness by carrier and state.</p> : null}
    </article>)}</section> : null}
  </div>
}
