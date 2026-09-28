import { useState, type FormEvent } from 'react'
import type { Option } from './types'
export type Field = { key: string; label: string; required?: boolean; type?: 'text' | 'email' | 'date' | 'checkbox' | 'textarea'; options?: Option[]; hint?: string; maxLength?: number }
type Props = { title: string; fields: Field[]; initial?: Record<string, unknown>; busy: boolean; onCancel: () => void; onSubmit: (values: Record<string, unknown>, reason: string) => Promise<void> }
export default function RecruitForm({ title, fields, initial = {}, busy, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map(f => [f.key, initial[f.key] ?? (f.type === 'checkbox' ? false : '')])))
  const [reason, setReason] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); if (!busy) await onSubmit(values, reason) }
  return <section className="crm-panel recruit-form" aria-label={title}>
    <div className="crm-panel-head"><h2>{title}</h2><button type="button" className="crm-text-btn" disabled={busy} onClick={onCancel}>Cancel</button></div>
    <form onSubmit={submit}>
      <div className="recruit-fields">{fields.map(field => <label className="crm-field" key={field.key}>
        {field.label}{field.required ? ' *' : ''}
        {field.options ? <select required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })}>
          <option value="">Select…</option>{field.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select> : field.type === 'checkbox' ? <input type="checkbox" disabled={busy} checked={Boolean(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.checked })} />
          : field.type === 'textarea' ? <textarea maxLength={field.maxLength ?? 1000} required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />
          : <input type={field.type === 'email' ? 'email' : 'text'} maxLength={field.type === 'date' ? 10 : field.maxLength ?? 300} pattern={field.type === 'date' ? '\\d{4}-\\d{2}-\\d{2}' : undefined} placeholder={field.type === 'date' ? 'YYYY-MM-DD' : undefined} required={field.required} disabled={busy} value={String(values[field.key])} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />}
        {field.hint ? <span className="crm-muted">{field.hint}</span> : null}
      </label>)}</div>
      <label className="crm-field">Reason for this change *<textarea required maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
      <p className="crm-muted">Use non-sensitive references only. Keep identity documents, banking details, and background-check information in the approved external process.</p>
      <button className="crm-primary-btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  </section>
}
