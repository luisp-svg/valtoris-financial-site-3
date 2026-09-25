import { useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { changeArchive, type ArchiveKind } from './archiveApi'
export default function ArchiveButton({ kind, id, name, onArchived }: { kind: ArchiveKind; id: string; name: string; onArchived: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function archive() {
    setBusy(true); setError('')
    try { await changeArchive(createSupabaseBrowserClient(), kind, id, true); onArchived() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to archive this record.'); setBusy(false) }
  }
  return <div>
    {!confirm ? <button type="button" className="crm-text-btn" onClick={() => setConfirm(true)}>Delete / Archive</button> : <div className="crm-panel" aria-label="Confirm archive">
      <p>Archive {name}? It will leave active views. Linked history is preserved, and you can restore it from Archived records.</p>
      {kind === 'household' ? <p>Policies and other linked records are preserved. This does not cancel policies or close business.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" className="crm-secondary-btn" disabled={busy} onClick={() => { setConfirm(false); setError('') }}>Cancel</button>{' '}
      <button type="button" className="crm-primary-btn" disabled={busy} onClick={() => void archive()}>{busy ? 'Archiving…' : 'Archive with recovery'}</button>
    </div>}
  </div>
}
