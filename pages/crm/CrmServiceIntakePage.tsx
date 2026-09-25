import LifeSensitivePanel from '../../crm/serviceIntakes/LifeSensitivePanel'
import SharedProfilePanel from '../../crm/serviceIntakes/SharedProfilePanel'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { crmHouseholdPath } from '../../constants/routes'
import type { IntakeFormProps } from '../../crm/serviceIntakes/ServiceIntakeForm'
import { parseIntakeOrigin, type IntakeSource } from '../../crm/serviceIntakes/intakeSource'
import { type createServiceIntakeApi, type SavedServiceIntake } from '../../crm/serviceIntakes/serviceIntakeApi'
import type { IntakeOrigin } from '../../crm/serviceIntakes/intakeSource'
import { type IntakeAnswers } from '../../crm/serviceIntakes/studentLoanSchema'
import './studentLoanIntake.css'

export type ServiceIntakeDefinition = { sensitiveLife?: boolean; title: string; Form: ComponentType<IntakeFormProps>; api: ReturnType<typeof createServiceIntakeApi>; validate: (raw: unknown, complete?: boolean) => string[]; loadSource: (client: SupabaseClient, origin: IntakeOrigin) => Promise<IntakeSource> }
export default function CrmServiceIntakePage({ definition }: { definition: ServiceIntakeDefinition }) {
  const { householdId = '' } = useParams()
  const [params] = useSearchParams()
  // Remount on source changes so previous client answers never appear under another source.
  return <IntakeWorkspace key={`${householdId}:${params.toString()}`} householdId={householdId} query={params.toString()} definition={definition} />
}
function IntakeWorkspace({ householdId, query, definition }: { householdId: string; query: string; definition: ServiceIntakeDefinition }) {
  const { Form, api, validate, loadSource, title } = definition
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const origin = useMemo(() => parseIntakeOrigin(householdId, new URLSearchParams(query)), [householdId, query])
  const [source, setSource] = useState<IntakeSource | null>(null)
  const [answers, setAnswers] = useState<IntakeAnswers | null>(null)
  const [saved, setSaved] = useState<SavedServiceIntake | null>(null)
  const [history, setHistory] = useState<SavedServiceIntake[]>([])
  const [baseline, setBaseline] = useState('')
  const [busy, setBusy] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [protectedDirty,setProtectedDirty]=useState(false)
  const dirty = protectedDirty || (answers !== null && JSON.stringify(answers) !== baseline)
  const completed = saved?.status === 'completed'

  useEffect(() => {
    let cancelled = false
    if (!origin) { setErrors(['Open this intake from an existing contact or a completed report card.']); setBusy(false); return }
    void Promise.all([loadSource(client, origin), api.fetchIntakes(client, origin)])
      .then(([loaded, records]) => {
        if (cancelled) return
        const current = records.find(r => r.status === 'draft') ?? records[0] ?? null
        const initial = current?.answers ?? loaded.answers
        setSource(loaded); setHistory(records); setSaved(current); setAnswers(initial); setBaseline(JSON.stringify(initial))
      }).catch(() => { if (!cancelled) setErrors(['This intake could not be loaded. Return to the household and try again.']) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [client, origin, api, loadSource])
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (link && !window.confirm('You have unsaved intake changes. Leave without saving?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty])

  const persist = async (complete: boolean) => {
    if (!origin || !answers || busy) return
    if (protectedDirty) { setErrors(['Save or close the protected details before saving or completing the intake.']); return }
    const problems = validate(answers, complete)
    setErrors(problems); setMessage('')
    if (problems.length) { setConfirmComplete(false); return }
    setBusy(true)
    try {
      const record = await api.saveIntake(client, origin, answers, saved, complete)
      setSaved(record); setAnswers(record.answers); setBaseline(JSON.stringify(record.answers))
      setHistory(previous => [record, ...previous.filter(r => r.id !== record.id)])
      setMessage(complete ? 'Intake completed. This version is preserved.' : 'Draft saved.')
      setConfirmComplete(false)
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Unable to save intake.']) }
    finally { setBusy(false) }
  }
  const selectRecord = (record: SavedServiceIntake) => {
    if (dirty && !window.confirm('Discard unsaved changes and open this saved intake?')) return
    setProtectedDirty(false); setSaved(record); setAnswers(record.answers); setBaseline(JSON.stringify(record.answers)); setErrors([]); setMessage(''); setConfirmComplete(false)
  }
  return <div className="crm-page crm-service-intake">
    <header className="crm-page-header"><div>
      <Link to={crmHouseholdPath(householdId)}>Household overview</Link>
      <h1 className="crm-page-title">{title}</h1>
      {source && <p>{source.clientName} · From {source.sourceLabel}{source.sourceDate ? ` · ${new Date(source.sourceDate).toLocaleDateString()}` : ''}</p>}
      <p className="crm-muted">Private advisor intake. Original report-card answers and grades remain unchanged.</p>
    </div></header>
    {errors.length > 0 && <div className="crm-banner crm-banner-error" role="alert"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
    {message && <p role="status">{message}</p>}
    {!source || !answers ? (busy ? <p role="status">Loading intake…</p> : null) : <>
      {origin?.kind === 'member' && <SharedProfilePanel key={origin.id} householdId={householdId} memberId={origin.id} onUse={completed ? undefined : facts => { if (window.confirm('Replace the name and contact details in this draft with the saved shared information?')) { setAnswers(previous => previous ? {...previous,sections:{...previous.sections,client:[{...previous.sections.client[0],firstName:facts.firstName,lastName:facts.lastName,email:facts.email,phone:facts.phone,state:facts.state,confirmed:'Not yet'}]}} : previous) } }} />}
      {definition.sensitiveLife && <LifeSensitivePanel key={saved?.id ?? 'new'} householdId={householdId} intakeId={saved?.id ?? null} completed={completed} onDirtyChange={setProtectedDirty} />}
      {history.length > 0 && <section className="crm-panel"><h2>Saved intakes for this contact or report</h2>
        <div className="crm-service-intake-history">{history.map(record => <button key={record.id} type="button" disabled={busy} className="crm-secondary-btn" aria-pressed={saved?.id === record.id} onClick={() => selectRecord(record)}>
          {record.status === 'draft' ? 'Draft' : 'Completed'} · {new Date(record.updatedAt).toLocaleString()}
        </button>)}</div>
      </section>}
      {source.priorResponses.length > 0 && <details className="crm-panel"><summary>View original report-card answers</summary><p>Submitted {source.sourceDate ? new Date(source.sourceDate).toLocaleDateString() : 'previously'}. Confirm current details with the client.</p><dl>{source.priorResponses.map(r => <div key={r.id}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></details>}
      {completed && <div className="crm-panel"><p>This completed intake is read-only. Start another review to record changes.</p><button type="button" className="crm-secondary-btn" disabled={busy} onClick={() => {
        const draft = history.find(r => r.status === 'draft')
        if (draft) { selectRecord(draft); return }
        setSaved(null); setAnswers(source.answers); setBaseline(JSON.stringify(source.answers)); setMessage('New review started. Confirm current information and save a draft.'); setErrors([])
      }}>{history.some(r => r.status === 'draft') ? 'Resume current draft' : 'Start another review'}</button></div>}
      <Form answers={answers} disabled={busy || completed} onChange={next => { setAnswers(next); setMessage(''); setConfirmComplete(false) }} />
      {!completed && <div className="crm-service-intake-actions">
        <span>{busy ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Save a draft before completing intake'}</span>
        <button type="button" className="crm-secondary-btn" disabled={busy} onClick={() => void persist(false)}>Save draft</button>
        <button type="button" className="crm-primary-btn" disabled={busy || !saved} onClick={() => {
          const problems = validate(answers, true); setErrors(problems); setConfirmComplete(problems.length === 0)
        }}>Complete intake</button>
        {confirmComplete && <div role="alert"><p>Complete this intake? The saved version will become read-only.</p><button type="button" className="crm-primary-btn" disabled={busy} onClick={() => void persist(true)}>Confirm completion</button> <button type="button" className="crm-secondary-btn" disabled={busy} onClick={() => setConfirmComplete(false)}>Keep editing</button></div>}
      </div>}
    </>}
  </div>
}
