import { useEffect, useRef, useState, type FormEvent } from 'react'
import { licenseDateLabel, licenseDateToIso } from './licenseDates'
import type { Option } from './types'
export type Field = { key: string; label: string; required?: boolean; type?: 'text' | 'email' | 'date' | 'checkbox' | 'textarea' | 'checkboxes'; options?: Option[]; hint?: string; maxLength?: number }
type Props = { sensitive?: boolean; title: string; description?: string; submitLabel?: string; changeReason?: string; fields: Field[]; initial?: Record<string, unknown>; busy: boolean; onDirtyChange?: (dirty: boolean) => void; focusRequest?: number; onCancel: () => void; onSubmit: (values: Record<string, unknown>, reason: string) => Promise<void> }
export default function RecruitForm({ sensitive = false, title, description, submitLabel = 'Save changes', changeReason, fields, initial = {}, busy, onDirtyChange, focusRequest = 0, onCancel, onSubmit }: Props) {
  const [initialValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map(f => [f.key, f.type === 'date' ? licenseDateLabel(initial[f.key] as string | undefined, '') : initial[f.key] ?? (f.type === 'checkboxes' ? [] : f.type === 'checkbox' ? false : '')])))
  const [values, setValues] = useState(initialValues)
  useEffect(() => { onDirtyChange?.(JSON.stringify(values) !== JSON.stringify(initialValues)) }, [values, initialValues, onDirtyChange])
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start' }); panel.current?.focus() }, [focusRequest])
  const reason = changeReason ?? `${title} saved through Licensing & Appointments.`
  const [dateError, setDateError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    const payload = {...values}; setDateError('')
    for (const field of fields.filter(field => field.type === 'date')) {
      const iso = licenseDateToIso(String(values[field.key] ?? ''))
      if (iso === null) { setDateError(`Enter a valid ${field.label.toLowerCase()} as MM/DD/YYYY.`); panel.current?.scrollIntoView({block:'start'}); panel.current?.focus(); return }
      payload[field.key] = iso
    }
    await onSubmit(payload, reason)
  }
  return <section ref={panel} tabIndex={-1} className="crm-panel recruit-form" aria-label={title}>
    <div className="crm-panel-head"><h2>{title}</h2><button type="button" className="crm-text-btn" disabled={busy} onClick={onCancel}>Cancel</button></div>
    {description ? <p>{description}</p> : null}
    {dateError ? <p role="alert" className="crm-banner crm-banner-error">{dateError}</p> : null}
    <form onSubmit={submit}>
      <div className="recruit-fields">{fields.map(field => field.type === 'checkboxes' ? <fieldset className="crm-field license-type-options" key={field.key}><legend>{field.label}</legend>{field.options?.map(option => <label key={option.id}><input type="checkbox" disabled={busy} checked={Array.isArray(values[field.key]) && (values[field.key] as string[]).includes(option.id)} onChange={e => { const selected = Array.isArray(values[field.key]) ? values[field.key] as string[] : []; setValues({ ...values, [field.key]: e.target.checked ? [...selected, option.id] : selected.filter(v => v !== option.id) }) }} />{option.name}</label>)}{field.hint ? <span className="crm-muted">{field.hint}</span> : null}</fieldset> : <label className="crm-field" key={field.key}>
        {field.label}{field.required ? ' *' : ''}
        {field.options ? <select required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })}>
          <option value="">Select…</option>{field.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select> : field.type === 'checkbox' ? <input type="checkbox" disabled={busy} checked={Boolean(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.checked })} />
          : field.type === 'textarea' ? <textarea maxLength={field.maxLength ?? 1000} required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />
          : <input type={field.type === 'email' ? 'email' : 'text'} maxLength={field.type === 'date' ? 10 : field.maxLength ?? 300} pattern={field.type === 'date' ? '\\d{2}/\\d{2}/\\d{4}' : undefined} placeholder={field.type === 'date' ? 'MM/DD/YYYY' : undefined} required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />}
        {field.hint ? <span className="crm-muted">{field.hint}</span> : null}
      </label>)}</div>
      <p className="crm-muted">{sensitive ? 'Licensing managers only. Enter only the last four SSN digits. Do not upload identity documents.' : 'Use non-sensitive references only. Keep identity documents, banking details, and background-check information in the approved external process.'}</p>
      <button className="crm-primary-btn" disabled={busy} type="submit">{busy ? 'Saving…' : submitLabel}</button>
    </form>
  </section>
}
