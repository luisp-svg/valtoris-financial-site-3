import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { recruitCommand, recruitDetail, recruitOptions, recruitingError, recruitingManager } from '../../crm/recruiting/api'
import type { CarrierReview, Credential, Option } from '../../crm/recruiting/types'
import { stageLabel } from '../../crm/recruiting/types'
import RecruitForm from '../../crm/recruiting/RecruitForm'
import { carrierFields, credentialFields, editFields } from '../../crm/recruiting/formFields'
import { readinessGaps } from '../../crm/recruiting/readiness'
import '../../crm/recruiting/recruiting.css'
type Detail = Awaited<ReturnType<typeof recruitDetail>>
type Form = { kind: 'edit' } | { kind: 'credential'; credentialKind: 'license' | 'eo'; item?: Credential } | { kind: 'carrier'; item?: CarrierReview }
export default function CrmRecruitDetailPage() {
  const { recruitId = '' } = useParams()
  const [data, setData] = useState<Detail | null>(null), [manager, setManager] = useState(false), [options, setOptions] = useState<{ advisors: Option[]; carriers: Option[] }>({ advisors: [], carriers: [] })
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [reload, setReload] = useState(0), [form, setForm] = useState<Form | null>(null)
  useEffect(() => { let active = true; setLoading(true); setError('')
    ;(async () => { try { const db = createSupabaseBrowserClient(); const canManage = await recruitingManager(db); const [detail, lists] = await Promise.all([recruitDetail(db, recruitId, canManage), canManage ? recruitOptions(db) : Promise.resolve({ advisors: [], carriers: [] })]); if (active) { setData(detail); setManager(canManage); setOptions(lists) } } catch (e) { if (active) { setData(null); setManager(false); setForm(null); setError(recruitingError(e)) } } finally { if (active) setLoading(false) } })()
    return () => { active = false }
  }, [recruitId, reload])
  async function save(values: Record<string, unknown>, reason: string) {
    if (!data || !form || busy) return
    setBusy(true); setError(''); setSuccess('')
    const payload = { ...values }
    if (form.kind === 'credential') { payload.kind = form.credentialKind; payload.id = form.item?.id ?? null; if (form.credentialKind === 'eo') { payload.state = null; payload.authority_scope = null } }
    if (form.kind === 'carrier') payload.id = form.item?.id ?? null
    try { await recruitCommand(createSupabaseBrowserClient(), data.record, form.kind, payload, reason); setForm(null); setSuccess('Changes saved.'); setReload(v => v + 1) } catch (e) { setError(recruitingError(e)) } finally { setBusy(false) }
  }
  const today = new Date().toISOString().slice(0, 10)
  return <div className="recruiting-page">
    <Link to="/crm/recruiting">Back to recruiting</Link>
    {error ? <p className="crm-banner crm-banner-error" role="alert">{error}</p> : null}
    {success ? <p className="crm-banner crm-banner-success" role="status">{success}</p> : null}
    <button className="crm-text-btn" disabled={busy || loading} onClick={() => { if (!form || window.confirm('Discard unsaved changes and refresh?')) { setForm(null); setReload(v => v + 1) } }}>Refresh record</button>
    {loading ? <p>Loading onboarding record…</p> : null}
    {!loading && data ? <>
      <header className="crm-page-header"><div><p className="crm-page-eyebrow">Advisor onboarding</p><h1 className="crm-page-title">{data.record.full_name}</h1><p>{data.record.email}{data.record.phone ? ` · ${data.record.phone}` : ''}</p><p>Recorded stage: <strong>{stageLabel(data.record.stage)}</strong>{data.record.is_archived ? ' · Archived' : ''}</p></div>{manager ? <button className="crm-primary-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'edit' })}>Edit recruit</button> : null}</header>
      <section className="crm-panel"><div className="crm-panel-head"><h2>Next step</h2></div><p>{data.record.next_action || 'No next action set'}</p><p>Follow-up: {data.record.next_action_due_on || 'No date set'}</p></section>
      {form && manager ? <RecruitForm key={form.kind + ('item' in form ? form.item?.id ?? 'new' : '')} title={form.kind === 'edit' ? 'Edit recruit' : form.kind === 'credential' ? `${form.item ? 'Update' : 'Add'} ${form.credentialKind === 'eo' ? 'E&O' : 'license'}` : 'Carrier contracting and appointment'}
        fields={form.kind === 'edit' ? editFields(options.advisors) : form.kind === 'credential' ? credentialFields(form.credentialKind) : carrierFields(options.carriers)}
        initial={form.kind === 'edit' ? { ...data.record } : { ...form.item, ...(form.kind === 'carrier' ? { review_now: false } : {}) }} busy={busy} onCancel={() => setForm(null)} onSubmit={save} /> : null}
      <section className="crm-panel" aria-label="Current readiness"><div className="crm-panel-head"><h2>Current carrier readiness</h2></div><p className="crm-muted">Internal review for each carrier, state, and scope. A recorded stage does not establish current readiness for every product or state.</p>
        {data.readiness.length === 0 ? <p>No carrier review recorded. Add a carrier, state, and scope to review readiness.</p> : data.readiness.map(scope => { const item = data.carriers.find(c => c.id === scope.id); const gaps = item ? readinessGaps(item, data.credentials, today) : []; return <article key={scope.id}><h3>{scope.carrier_name} · {scope.state} · {scope.authority_scope}</h3><p><strong>{scope.ready ? 'Ready — current verified records and review' : 'Not currently ready'}</strong></p>{!scope.ready ? <ul>{(gaps.length ? gaps : ['Review carrier availability and current evidence']).map(gap => <li key={gap}>{gap}</li>)}</ul> : null}</article> })}
      </section>
      <section className="crm-panel"><div className="crm-panel-head"><h2>Licenses and E&O</h2></div>{manager && !data.record.is_archived ? <div className="recruit-actions"><button className="crm-secondary-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'credential', credentialKind: 'license' })}>Add license</button><button className="crm-secondary-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'credential', credentialKind: 'eo' })}>Add E&O</button></div> : null}
        <p className="crm-muted">For renewals, update the existing requirement. Prior values remain in the change history.</p>
        {data.credentials.length === 0 ? <p>No credential evidence recorded. Existing licensed-state profile labels are not verified evidence here.</p> : data.credentials.map(c => <article key={c.id}><h3>{c.kind === 'eo' ? 'E&O' : `License · ${c.state} · ${c.authority_scope}`}</h3><p>{c.provider_reference} · {c.status}</p><p>Effective: {c.effective_on || 'Unknown'} · Expires: {c.no_expiration ? 'No expiration confirmed' : c.expires_on || 'Unknown'}</p>{c.expires_on && c.expires_on < today ? <p className="crm-banner crm-banner-error">Expired</p> : c.expires_on && c.expires_on <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) ? <p>Expires within 30 days</p> : null}<p>Evidence: {c.evidence_reference || 'Not recorded'}</p>{manager && !data.record.is_archived ? <button className="crm-text-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'credential', credentialKind: c.kind, item: c })}>Update {c.kind === 'eo' ? 'E&O' : 'license'}</button> : null}</article>)}
      </section>
      <section className="crm-panel"><div className="crm-panel-head"><h2>Contracting and appointments</h2></div>{manager && !data.record.is_archived ? <button className="crm-secondary-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'carrier' })}>Add carrier review</button> : null}
        {data.carriers.length === 0 ? <p>No carrier records yet.</p> : data.carriers.map(c => <article key={c.id}><h3>{data.readiness.find(s => s.id === c.id)?.carrier_name || 'Carrier'} · {c.state} · {c.authority_scope}</h3><p>Contracting: {c.contract_status} · Appointment: {c.appointment_status}</p><p>Reviewed: {c.reviewed_at ? c.reviewed_at.slice(0, 10) : 'Review needed'}</p>{manager && !data.record.is_archived ? <button className="crm-text-btn" disabled={Boolean(form)} onClick={() => setForm({ kind: 'carrier', item: c })}>Update carrier review</button> : null}</article>)}
      </section>
      {manager ? <section className="crm-panel"><div className="crm-panel-head"><h2>Change history</h2></div><p className="crm-muted">Latest 100 changes. Earlier history is retained.</p>{data.history.map(h => <details key={h.id}><summary>{h.occurred_at.slice(0, 16).replace('T', ' ')} · {h.action} · {h.reason}</summary><dl>{Object.entries(h.after_data).filter(([key, value]) => !['id','recruit_id','created_by','verified_by','reviewed_by','assigned_advisor_id','advisor_profile_id'].includes(key) && JSON.stringify(value) !== JSON.stringify(h.before_data?.[key])).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{String(h.before_data?.[key] ?? 'Not set')} → {String(value ?? 'Not set')}</dd></div>)}</dl></details>)}</section> : null}
    </> : null}
  </div>
}
