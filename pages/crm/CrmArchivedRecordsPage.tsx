import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { changeArchive, loadArchived, type ArchiveKind, type ArchivedRecord } from '../../crm/archive/archiveApi'
export default function CrmArchivedRecordsPage() {
  const [kind, setKind] = useState<ArchiveKind>('household')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ArchivedRecord[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [success, setSuccess] = useState('')
  useEffect(() => {
    let cancelled = false
    setRows(null); setError('')
    void loadArchived(createSupabaseBrowserClient(), kind, page).then(r => { if (!cancelled) setRows(r) }).catch(() => { if (!cancelled) setError('Unable to load archived records. Please retry.') })
    return () => { cancelled = true }
  }, [kind, page, revision])
  async function restore(row: ArchivedRecord) {
    setBusy(true); setError(''); setSuccess('')
    try {
      await changeArchive(createSupabaseBrowserClient(), kind, row.id, false)
      setSuccess(`${row.display_name} restored.`); setRevision(r => r + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to restore record.') }
    finally { setBusy(false) }
  }
  return <div className="crm-page">
    <header className="crm-page-header"><div><h1>Archived records</h1><p>Restore records removed with recovery. Restore a household before its contacts or prospects.</p><Link to="/crm/households">Back to households</Link></div></header>
    <label>Record type <select disabled={busy} value={kind} onChange={e => { setKind(e.target.value as ArchiveKind); setPage(0); setSuccess('') }}><option value="household">Households / clients</option><option value="lead">Contacts / prospects / leads</option></select></label>
    {success ? <p role="status">{success}</p> : null}
    {error ? <p role="alert">{error} <button disabled={busy} onClick={() => setRevision(r => r + 1)}>Retry</button></p> : null}
    {!rows && !error ? <p role="status">Loading…</p> : null}
    {rows?.length === 0 ? <p>No archived records on this page.</p> : null}
    {rows?.map(row => <section className="crm-panel" key={row.id}><h2>{row.display_name}</h2><p>{row.record_type} · Archived {new Date(row.archived_at).toLocaleString()}</p>
      {kind === 'lead' && row.household_archived ? <p>Restore this household from the Households / clients view first.</p> : <button className="crm-secondary-btn" disabled={busy} onClick={() => void restore(row)}>Restore</button>}
    </section>)}
    <button disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>{' '}
    <button disabled={busy || !rows || rows.length < 50} onClick={() => setPage(p => p + 1)}>Next</button>
  </div>
}
