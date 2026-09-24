import { useEffect, useState } from 'react'
import Widget from '../../../components/ui/Widget'
import InsuranceQuoteDetail from '../../../intake/InsuranceQuoteDetail'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import { loadHouseholdInsuranceQuotes } from '../../insuranceQuotesApi'

type QuoteHistory = Awaited<ReturnType<typeof loadHouseholdInsuranceQuotes>>

export default function InsuranceQuotesWidget({ householdId }: { householdId: string }) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [history, setHistory] = useState<QuoteHistory | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setError(false)
    async function load() {
      try {
        const result = await loadHouseholdInsuranceQuotes(createSupabaseBrowserClient(), householdId, page)
        if (!cancelled) setHistory(result)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [householdId, page, attempt])

  return <Widget title="Insurance quote requests" titleId="crm-widget-insurance-quotes" wide>
    <p className="crm-muted">Open a request to review the information submitted by the client.</p>
    {error ? <div role="alert"><p>Unable to load quote requests.</p><button type="button" className="crm-text-btn" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>
      : !history ? <p role="status">Loading quote requests…</p>
      : <>
        {history.items.length === 0 ? <p className="crm-muted">No insurance quote requests linked to this household.</p> : null}
        {history.items.map(item => <details key={item.id} className="crm-insurance-quote-request">
          <summary>{item.leadType} · {new Date(item.submittedAt).toLocaleString()} · View submitted answers</summary>
          {item.quote ? <InsuranceQuoteDetail quote={item.quote} /> : <p role="status">The submitted answers are unavailable. Please review this request in Intake.</p>}
        </details>)}
        {page > 0 || history.hasMore ? <div className="crm-intake-resolution-actions" aria-label="Quote history pages">
          <button type="button" className="crm-text-btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Newer requests</button>
          <button type="button" className="crm-text-btn" disabled={!history.hasMore} onClick={() => setPage(value => value + 1)}>Older requests</button>
        </div> : null}
      </>}
  </Widget>
}
