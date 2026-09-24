import { FormEvent, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ChoiceGroup from '../components/assessment/ChoiceGroup'
import SelectInput from '../components/assessment/SelectInput'
import TextInput from '../components/assessment/TextInput'
import FieldShell, { fieldId } from '../components/assessment/FieldShell'
import { activeFields, activeSections, CONTACT_FIELDS, pruneAnswers, QUOTE_CONSENT_VERSION, QUOTE_CONTACT_COPY, QUOTE_LABELS, QUOTE_STORAGE_COPY } from '../modules/insuranceQuote/catalog'
import type { QuoteAnswers, QuoteField, QuoteKind, QuoteValue } from '../modules/insuranceQuote/catalog'
import { fieldError } from '../modules/insuranceQuote/validation'
import '../components/insuranceQuote.css'

function QuoteControl({ field, value, name = field.id, onChange }: { field: QuoteField; value: QuoteValue | undefined; name?: string; onChange: (value: QuoteValue) => void }) {
  if (field.type === 'rows') {
    const entries = Array.isArray(value) ? value as Record<string, string>[] : []
    return <fieldset className="quote-repeater"><legend>{field.label}{field.required ? ' *' : ''}</legend>
      {entries.map((row, index) => <div className="quote-repeat-row" key={index}><div className="quote-row-title"><h3>{field.label} · {index + 1}</h3><button type="button" onClick={() => onChange(entries.filter((_, i) => i !== index))} aria-label={`Remove ${field.label.toLowerCase()} entry ${index + 1}`}>Remove</button></div><div className="quote-grid">{field.fields!.map(child => <QuoteControl key={child.id} field={child} name={`${name}-${index}-${child.id}`} value={row[child.id]} onChange={next => onChange(entries.map((entry, i) => i === index ? { ...entry, [child.id]: String(next) } : entry))} />)}</div></div>)}
      <button type="button" className="quote-secondary" disabled={entries.length >= 20} onClick={() => onChange([...entries, {}])}>+ Add {field.label.toLowerCase()} entry</button>
    </fieldset>
  }
  if (field.type === 'multi') return <ChoiceGroup label={field.label} name={name} required={field.required} selected={Array.isArray(value) ? value as string[] : []} options={field.options!.map(option => ({ value: option, label: option }))} onChange={next => {
    const latest = next[next.length - 1]
    onChange(latest === 'None' || latest === 'Not sure' ? [latest] : next.filter(item => item !== 'None' && item !== 'Not sure'))
  }} />
  if (field.type === 'select') return <SelectInput label={field.label} name={name} value={typeof value === 'string' ? value : ''} required={field.required} options={field.options!.map(option => ({ value: option, label: option }))} onChange={onChange} placeholder="Choose an option" />
  if (field.type === 'date' || field.type === 'number') return <FieldShell label={field.label} name={name} required={field.required}><input className="assessment-input" id={fieldId(name)} name={name} type={field.type} min={field.type === 'date' ? '1900-01-01' : 0} max={field.type === 'date' ? (field.id === 'birthDate' ? new Date().toISOString().slice(0, 10) : '2100-12-31') : field.max} step={field.type === 'number' ? '0.01' : undefined} required={field.required} value={typeof value === 'string' ? value : ''} onChange={event => onChange(event.target.value)} /></FieldShell>
  return <TextInput label={field.label} name={name} type={field.type ?? 'text'} value={typeof value === 'string' ? value : ''} required={field.required} maxLength={field.maxLength ?? 300} onChange={onChange} />
}

export default function InsuranceQuotePage({ kind }: { kind: QuoteKind }) {
  const [answers, setAnswers] = useState<QuoteAnswers>({})
  const [contact, setContact] = useState<QuoteAnswers>({})
  const [step, setStep] = useState(0)
  const [permissions, setPermissions] = useState({ storage: false, contact: false, privacy: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [website, setWebsite] = useState('')
  const [startedAt] = useState(Date.now)
  const [submissionId] = useState(() => crypto.randomUUID())
  const requestLock = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const sections = [{ id: 'contact', title: 'How can we reach you?', fields: CONTACT_FIELDS, description: 'Start with your contact details. Fields marked * are required.' }, ...activeSections(kind, answers)]
  const review = step >= sections.length
  const section = sections[Math.min(step, sections.length - 1)]
  function move(next: number) { setStep(next); setError(''); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }) }
  function checkSection(): string | null {
    const values = step === 0 ? contact : answers
    for (const field of activeFields(section.fields, values)) { const issue = fieldError(field, values[field.id]); if (issue) return issue }
    return null
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestLock.current) return
    if (!review) { const issue = checkSection(); if (issue) { setError(issue); return }; move(step + 1); return }
    if (!permissions.storage || !permissions.contact || !permissions.privacy) { setError('Please review and acknowledge the permissions below.'); return }
    setBusy(true); requestLock.current = true; setError('')
    try {
      const response = await fetch('/api/insurance-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, kind, submissionId, formStartedAt: startedAt, website, contact, answers: pruneAnswers(kind, answers), consent: { version: QUOTE_CONSENT_VERSION, ...permissions } }), signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok || result.ok !== true) { setError((response.status === 400 || response.status === 409) && typeof result.error === 'string' ? result.error : 'We could not confirm your request was saved. Please try again. Your answers are still here.'); return }
      setComplete(true); setAnswers({}); setContact({}); requestAnimationFrame(() => heading.current?.focus())
    } catch { setError('We could not confirm your request was saved. Check your connection and retry. Your answers are still here.') }
    finally { setBusy(false); requestLock.current = false }
  }
  if (complete) return <section className="quote-shell"><div className="quote-success"><span className="quote-eyebrow">VALTORIS FINANCIAL</span><h1 ref={heading} tabIndex={-1}>Your request is in.</h1><p>Your {kind === 'commercial' ? 'commercial insurance' : kind + ' insurance'} information has been saved for Valtoris advisor review.</p><p>This request does not bind coverage or guarantee a quote. An advisor will review your details and next steps.</p><Link to="/">Return to Valtoris</Link></div></section>
  return <section className="quote-shell"><header className="quote-intro"><span className="quote-eyebrow">VALTORIS FINANCIAL · INSURANCE</span><h1>{QUOTE_LABELS[kind]} Request</h1><p>Tell us what you’d like to protect. We’ll help you take the next step.</p><div className="quote-meta"><span>Private advisor review</span><span>No obligation</span><span>{kind === 'commercial' ? 'About 10–15 minutes' : 'About 5–10 minutes'}</span></div></header>
    <div className="quote-layout"><aside className="quote-sidebar"><p className="quote-eyebrow">YOUR REQUEST</p><ol>{[...sections.map(item => item.title), 'Review and send'].map((title, index) => <li key={title} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : String(index + 1).padStart(2, '0')}</span>{title}</li>)}</ol><p className="quote-note">Your answers stay on this page until you submit. Closing or refreshing clears them.</p></aside>
    <form className="quote-card" onSubmit={submit}><div className="quote-progress"><span>Step {step + 1} of {sections.length + 1}</span><progress value={step + 1} max={sections.length + 1} aria-label="Form progress" /></div><h2 ref={heading} tabIndex={-1}>{review ? 'Review and send' : section.title}</h2>
      <div className="quote-trap" aria-hidden="true"><label>Website<input name="website" value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
      {review ? <><p>Review your information before sending it for advisor follow-up.</p>{sections.map((item, index) => <details className="quote-review" key={item.id}><summary>{item.title}</summary><dl>{activeFields(item.fields, index === 0 ? contact : answers).map(field => { const value = (index === 0 ? contact : answers)[field.id]; return <div key={field.id}><dt>{field.label}</dt><dd>{field.type === 'rows' && Array.isArray(value) ? (value as Record<string, string>[]).map((row, i) => <div key={i}>{field.fields!.map(child => row[child.id] ? <p key={child.id}>{child.label}: {row[child.id]}</p> : null)}</div>) : Array.isArray(value) ? value.join(', ') : value || 'Not provided'}</dd></div> })}</dl><button type="button" onClick={() => move(index)} className="quote-secondary">Edit {item.title.toLowerCase()}</button></details>)}
        <div className="quote-permissions"><label><input type="checkbox" checked={permissions.storage} onChange={event => setPermissions({ ...permissions, storage: event.target.checked })} required />{QUOTE_STORAGE_COPY}</label><label><input type="checkbox" checked={permissions.contact} onChange={event => setPermissions({ ...permissions, contact: event.target.checked })} required />{QUOTE_CONTACT_COPY}</label><label><input type="checkbox" checked={permissions.privacy} onChange={event => setPermissions({ ...permissions, privacy: event.target.checked })} required /><span>I have reviewed the <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span></label></div><p className="quote-note">This is a request for review, not an insurance application, binder, or guarantee of coverage or price. Coverage is subject to carrier underwriting and approval. Do not enter Social Security numbers, payment details, or medical records.</p></> : <><p>{section.description}</p><div className="quote-grid">{activeFields(section.fields, step === 0 ? contact : answers).map(field => <QuoteControl key={field.id} field={field} value={(step === 0 ? contact : answers)[field.id]} onChange={value => { if (step === 0) setContact(previous => ({ ...previous, [field.id]: value })); else setAnswers(previous => pruneAnswers(kind, { ...previous, [field.id]: value })) }} />)}</div></>}
      {error && <p className="quote-error" role="alert">{error}</p>}
      <div className="quote-actions">{step > 0 && <button type="button" className="quote-secondary" disabled={busy} onClick={() => move(step - 1)}>Back</button>}<button type="submit" className="quote-primary" disabled={busy}>{busy ? 'Saving your request…' : review ? 'Send quote request' : 'Continue →'}</button></div>
    </form></div></section>
}
