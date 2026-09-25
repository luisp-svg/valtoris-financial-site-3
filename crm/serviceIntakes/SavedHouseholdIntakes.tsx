import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { loadHouseholdSavedIntakes, type SavedIntakeSummary } from './intakeHubApi'

/** Open the existing source-specific history instead of creating another intake. */
export default function SavedHouseholdIntakes({ householdId }: { householdId: string }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ items: SavedIntakeSummary[]; hasMore: boolean } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setResult(null)
    setError(false)
    void loadHouseholdSavedIntakes(createSupabaseBrowserClient(), householdId, page)
      .then(data => { if (!cancelled) setResult(data) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [householdId, page, revision])
  return <section className="crm-saved-intakes" aria-label="Saved intakes for this household">
    <h3>Find a saved intake</h3>
    <p>Saved work across household members, contacts, and report cards, newest first. Open a saved intake to confirm the client and resume a draft or review its history.</p>
    {error ? <p role="alert">Saved intakes could not be loaded. Check again before starting another intake. <button type="button" onClick={() => setRevision(r => r + 1)}>Retry</button></p>
      : !result ? <p role="status">Loading saved intakes…</p>
        : <>
          {result.items.length === 0 ? <p>No saved intakes found on this page.</p> : <ul>{result.items.map(item => <li key={item.id}>
            <Link to={item.href}>{item.label} — {item.status === 'draft' ? 'Draft saved' : 'Completed'}</Link>
            {' · '}{new Date(item.updatedAt).toLocaleString()}
            {' · Started from '}{item.origin.kind === 'member' ? 'a household member' : item.origin.kind === 'contact' ? 'a contact' : 'a report card'}
          </li>)}</ul>}
          {page > 0 || result.hasMore ? <div className="crm-dashboard-quick-action-row">
            <button type="button" disabled={page === 0} onClick={() => { setResult(null); setPage(p => p - 1) }}>Newer intakes</button>
            <button type="button" disabled={!result.hasMore} onClick={() => { setResult(null); setPage(p => p + 1) }}>Older intakes</button>
          </div> : null}
        </>}
  </section>
}
