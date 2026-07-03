import { FormEvent, useState } from 'react'

type LeadFormProps = {
  source: string
  title?: string
  onSuccess?: (payload: Record<string, FormDataEntryValue>) => void
}

export default function LeadForm({ source, title = 'Request a consultation', onSuccess }: LeadFormProps) {
  const [status, setStatus] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, source })
    })

    if (response.ok) {
      setStatus('Thanks — your request was submitted.')
      onSuccess?.(payload)
      event.currentTarget.reset()
    } else {
      setStatus('Submission failed. Please try again.')
    }
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
      <button type="submit">Submit</button>
      {status ? <p className="notice">{status}</p> : null}
    </form>
  )
}
