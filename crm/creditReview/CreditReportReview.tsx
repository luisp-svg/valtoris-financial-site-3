import { useRef, useState } from 'react'
import { parseIdentityIq, reviewTradelines } from './report'

type Review = ReturnType<typeof reviewTradelines>

export default function CreditReportReview() {
  const [review, setReview] = useState<Review>([])
  const [status, setStatus] = useState('')
  const [reading, setReading] = useState(false)
  const request = useRef(0)

  async function readReport(file: File) {
    const current = ++request.current
    setReview([])
    setStatus('')
    setReading(true)
    try {
      if (!/\.html?$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
        setStatus('Choose an IdentityIQ HTML export under 10 MB.')
        return
      }
      const lines = parseIdentityIq(await file.text())
      if (current !== request.current) return
      if (!lines.length) {
        setStatus('No supported account entries were found. Use a saved IdentityIQ report that includes the account details.')
        return
      }
      setReview(reviewTradelines(lines))
      setStatus(`Reviewed ${lines.length} bureau entries.`)
    } catch {
      if (current === request.current) setStatus('The report could not be read.')
    } finally {
      if (current === request.current) setReading(false)
    }
  }

  const flagged = review.filter(line => line.checks.length)
  return (
    <section className="crm-panel" aria-labelledby="credit-report-review-heading">
      <div className="crm-panel-head">
        <h2 id="credit-report-review-heading">Credit report review</h2>
      </div>
      <p>Choose an IdentityIQ HTML export. TAC reads the report in this browser for this session.</p>
      <label>
        Credit report{' '}
        <input type="file" accept=".html,.htm" onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void readReport(file)
        }} />
      </label>
      {(review.length > 0 || reading) && <button type="button" className="crm-text-btn" onClick={() => {
        request.current++
        setReview([])
        setStatus('')
        setReading(false)
      }}>Clear review</button>}
      <p role="status">{reading ? 'Reading report…' : status}</p>
      {review.length > 0 && (
        <>
          <h3>{flagged.length} entries to verify</h3>
          <p>Confirm the supporting records before disputing a reported field.</p>
          {flagged.map(line => (
            <details key={`${line.accountGroup}-${line.bureau}`}>
              <summary>{line.creditor}{line.originalCreditor ? ` / ${line.originalCreditor}` : ''} · {line.bureau} · {line.balance === null ? 'Balance unavailable' : line.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</summary>
              <p>{line.status}{line.opened ? ` · Opened ${line.opened}` : ''}{line.reported ? ` · Last reported ${line.reported}` : ''}</p>
              <ul>{line.checks.map(check => <li key={check}>{check}</li>)}</ul>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
