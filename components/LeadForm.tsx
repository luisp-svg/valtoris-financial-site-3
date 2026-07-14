import { FormEvent, useState } from 'react'
import { submitLeadFormLead } from './reportCard/submitReportCardLead'

type LeadFormProps = {
  source: string
  title?: string
  onSuccess?: (payload: Record<string, FormDataEntryValue>) => void
}

export default function LeadForm({ source, title = 'Request a consultation', onSuccess }: LeadFormProps) {
  const [status, setStatus] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = Object.fromEntries(formData.entries())

    const submission = await submitLeadFormLead(source, payload)
    if (!submission.ok) {
      console.error('Google Sheets submission failed:', submission.error)
      setStatus(
        'We could not submit your request right now. Please try again or schedule a strategy session directly.',
      )
      return
    }

    setStatus('Thanks — your request was submitted.')
    void onSuccess?.(payload)
    form.reset()
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <input name="name" placeholder="Full name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="phone" placeholder="Phone" required />
      <select name="interest" defaultValue="">
        <option value="" disabled>Select service interest</option>
        <option value="life-insurance">Life insurance</option>
        <option value="annuities">Annuities</option>
        <option value="health">Health</option>
        <option value="p-and-c">P&C</option>
        <option value="credit-repair">Credit repair</option>
        <option value="student-loans">Student loan strategy</option>
      </select>
      <textarea name="notes" rows={4} placeholder="Tell us about your goals" />
      <button type="submit" className="platform-btn platform-btn-primary">
        Submit
      </button>
      {status ? <p className="notice">{status}</p> : null}
    </form>
  )
}
