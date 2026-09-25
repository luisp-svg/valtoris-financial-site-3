import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Widget from '../components/ui/Widget'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import ArchiveButton from './ArchiveButton'
type Row = { id: string; lead_type: string; submitted_at: string }
export default function HouseholdRecordsWidget({ householdId }: { householdId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setRows(null); setError(false)
    void (async () => {
      try {
        const { data, error: err } = await createSupabaseBrowserClient().from('leads').select('id,lead_type,submitted_at').eq('household_id', householdId).is('deleted_at', null).order('submitted_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24)
        if (err) throw err
        if (!cancelled) setRows(data ?? [])
      } catch { if (!cancelled) setError(true) }
    })()
    return () => { cancelled = true }
  }, [householdId, page, revision])
  return <Widget title="Contacts and prospect records" wide actions={<Link to="/crm/archived">Archived records</Link>}>
    <p>Remove an individual contact or lead with recovery. The household and linked history remain available.</p>
    {error ? <p role="alert">Unable to load records. <button onClick={() => setRevision(r => r + 1)}>Retry</button></p> : !rows ? <p>Loading…</p> : <>
      {rows.length === 0 ? <p>No active records on this page.</p> : null}
      {rows.map(row => <div key={row.id}><p>{row.lead_type} · {new Date(row.submitted_at).toLocaleString()} {row.lead_type === 'Manual Contact' ? <Link to={`/crm/contacts/${row.id}`}>Open contact</Link> : null}</p><ArchiveButton kind="lead" id={row.id} name={row.lead_type} onArchived={() => setRevision(r => r + 1)} /></div>)}
      <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>{' '}<button disabled={rows.length < 25} onClick={() => setPage(p => p + 1)}>Next</button>
    </>}
  </Widget>
}
