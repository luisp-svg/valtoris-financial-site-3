import { useEffect, useId, useRef, useState } from 'react'
import {Link} from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { changeArchive, type ArchiveKind } from './archiveApi'
import './archive.css'
export default function ArchiveButton({ kind, id, name, onArchived }: { kind: ArchiveKind; id: string; name: string; onArchived: () => void }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const heading=useId(),description=useId(),dialog=useRef<HTMLDialogElement>(null),inFlight=useRef(false)
  useEffect(()=>{if(confirm&&!dialog.current?.open)dialog.current?.showModal()},[confirm])
  async function archive() {
    if(inFlight.current)return
    inFlight.current=true;setBusy(true);setError('')
    try { await changeArchive(createSupabaseBrowserClient(), kind, id, true);setConfirm(false);onArchived() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to archive this record.') }
    finally{inFlight.current=false;setBusy(false)}
  }
  return <div className="tac-record-removal">
    <button type="button" className="crm-text-btn" onClick={()=>{setError('');setConfirm(true)}}>Remove from active records</button>
    {confirm&&<dialog ref={dialog} className="tac-archive-dialog" aria-labelledby={heading} aria-describedby={description} onCancel={event=>{if(inFlight.current)event.preventDefault();else setConfirm(false)}}>
      <p className="tac-archive-eyebrow">Recoverable removal</p><h2 id={heading}>Remove {name}?</h2>
      <p id={description}>This {kind==='household'?'household':'contact or lead'} will leave your active lists. Its linked history stays on record.</p>
      <p>You can bring it back from <Link to="/crm/archived" onClick={()=>setConfirm(false)}>Archived records</Link>.</p>
      <details><summary>What happens to linked records?</summary><p>Duplicate reviews are retained, not resolved or merged. Restore the record before continuing a pending review.</p>{kind==='household'&&<p>Policies and other linked records stay on record. Removing the household does not cancel policies or close business.</p>}</details>
      {error&&<p role="alert" className="crm-banner crm-banner-error">{error}</p>}
      <div className="tac-archive-actions"><button type="button" className="crm-secondary-btn" disabled={busy} onClick={()=>setConfirm(false)}>Keep record</button><button type="button" className="crm-primary-btn" disabled={busy} onClick={()=>void archive()}>{busy?'Removing…':'Remove with recovery'}</button></div>
    </dialog>}
  </div>
}
