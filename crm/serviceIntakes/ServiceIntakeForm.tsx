import TextInput from '../../components/assessment/TextInput'
import SelectInput from '../../components/assessment/SelectInput'
import FieldShell, { fieldId } from '../../components/assessment/FieldShell'
import { emptyIntakeRow, type IntakeAnswers, type IntakeSection } from './studentLoanSchema'

export type IntakeFormProps = { answers: IntakeAnswers; onChange: (answers: IntakeAnswers) => void; disabled?: boolean }
type Props = IntakeFormProps & { title: string; sections: readonly IntakeSection[]; tracks?: readonly string[]; notice: string }
export default function ServiceIntakeForm({ answers, onChange, disabled = false, title, sections, tracks = [], notice }: Props) {
  const update = (section: string, index: number, key: string, value: string) => onChange({ ...answers, sections: { ...answers.sections, [section]: answers.sections[section].map((row, i) => i === index ? { ...row, [key]: value } : row) } })
  return <fieldset disabled={disabled} className="crm-service-intake-fields">
    <legend>{title}</legend>
    <p>{notice}</p>
    {tracks.length > 0 && <fieldset><legend>Requested review</legend>
      {tracks.map(track => <label key={track} className="crm-service-intake-choice"><input type="checkbox" checked={answers.tracks.includes(track)} onChange={e => onChange({ ...answers, tracks: e.target.checked ? [...answers.tracks, track] : answers.tracks.filter(t => t !== track) })} /> {track}</label>)}
      <p className="crm-muted">Select every relevant track. Removing a track keeps its saved answers available if you select it again; inactive sections are not treated as complete.</p>
    </fieldset>}
    {sections.filter(s => !s.track || answers.tracks.includes(s.track)).map(section => <section className="crm-panel" key={section.id} aria-labelledby={`intake-${section.id}`}>
      <h2 id={`intake-${section.id}`}>{section.title}</h2><p className="crm-muted">{section.description}</p>
      {answers.sections[section.id].map((row, index) => <fieldset key={index} className="crm-service-intake-row">
        <legend>{section.repeatable ? `${section.title} ${index + 1}` : section.title}</legend>
        <div className="crm-service-intake-grid">{section.fields.map(f => {
          const name = `intake-${section.id}-${index}-${f.id}`
          const change = (value: string) => update(section.id, index, f.id, value)
          if (f.kind === 'select') return <SelectInput key={f.id} label={f.label} name={name} value={row[f.id]} onChange={change} options={(f.options ?? []).map(value => ({ value, label: value }))} required={f.required} />
          if (f.kind === 'multiline' || f.kind === 'date') return <FieldShell key={f.id} label={f.label} name={name} required={f.required}>
            {f.kind === 'date' ? <input id={fieldId(name)} type="date" className="assessment-input" value={row[f.id]} onChange={e => change(e.target.value)} /> : <textarea id={fieldId(name)} className="assessment-input" rows={3} maxLength={2000} value={row[f.id]} onChange={e => change(e.target.value)} />}
          </FieldShell>
          return <TextInput key={f.id} label={f.label} name={name} value={row[f.id]} onChange={change} type={f.kind === 'email' ? 'email' : 'text'} inputMode={f.kind === 'money' || f.kind === 'number' ? 'decimal' : undefined} maxLength={300} required={f.required} />
        })}</div>
        {section.repeatable ? <button type="button" className="crm-secondary-btn" onClick={() => onChange({ ...answers, sections: { ...answers.sections, [section.id]: answers.sections[section.id].filter((_, i) => i !== index) } })}>Remove {section.title.toLowerCase()} {index + 1}</button> : null}
      </fieldset>)}
      {section.repeatable ? <button type="button" className="crm-secondary-btn" disabled={answers.sections[section.id].length >= 50} onClick={() => onChange({ ...answers, sections: { ...answers.sections, [section.id]: [...answers.sections[section.id], emptyIntakeRow(section)] } })}>Add {section.title.toLowerCase()} record</button> : null}
    </section>)}
  </fieldset>
}
