import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { downloadHouseholdDocument, listHouseholdDocuments, uploadHouseholdDocument, validateQuoteFile, type HouseholdDocument } from './documentsApi'

export default function HouseholdDocuments({ householdId, quoteOnly = false, title = 'Documents' }: { householdId: string; quoteOnly?: boolean; title?: string }) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const [documents, setDocuments] = useState<HouseholdDocument[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [docType, setDocType] = useState('pc_quote_auto')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listHouseholdDocuments(client, householdId).then(rows => { if (!cancelled) setDocuments(rows) })
      .catch(() => { if (!cancelled) setError('Documents could not be loaded. Try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client, householdId, attempt])
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!files.length || busy) return
    setBusy(true); setError(''); setMessage('')
    let uploaded = 0
    try {
      files.forEach(validateQuoteFile)
      for (const file of files) { await uploadHouseholdDocument(client, householdId, file, docType); uploaded++ }
      setFiles([]); (event.target as HTMLFormElement).reset(); setDocType('pc_quote_auto')
      setMessage(`${uploaded} document${uploaded === 1 ? '' : 's'} uploaded.`)
    } catch (e) {
      setFiles(previous => previous.slice(uploaded))
      setError(`${uploaded ? `${uploaded} uploaded. ` : ''}${e instanceof Error ? e.message : 'Upload failed. Try again.'}`)
    } finally { setBusy(false); setAttempt(value => value + 1) }
  }
  async function download(document: HouseholdDocument) {
    setError('')
    try {
      const blob = await downloadHouseholdDocument(client, document)
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.file_name; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('This document could not be downloaded. Try again.') }
  }
  const shown = documents.filter(document => !quoteOnly || document.doc_type.startsWith('pc_quote_'))
  return <section className="crm-panel" aria-label={title}>
    <h2>{title}</h2>
    <p className="crm-muted">Upload PDFs up to 20 MB each. Files are private to advisors who can access this household.</p>
    <form onSubmit={event => void upload(event)}>
      <label>Document category <select value={docType} disabled={busy} onChange={event => setDocType(event.target.value)}>
        <option value="pc_quote_auto">Auto quote documents</option><option value="pc_quote_home">Home quote documents</option>
        <option value="pc_quote_umbrella">Umbrella quote documents</option><option value="pc_quote_other">Other P&C documents</option>
      </select></label>
      <label>PDF documents <input type="file" accept="application/pdf,.pdf" multiple disabled={busy} onChange={event => { setFiles(Array.from(event.target.files ?? [])); setError(''); setMessage('') }} /></label>
      <button type="submit" className="crm-primary-btn" disabled={busy || !files.length}>{busy ? 'Uploading…' : 'Upload documents'}</button>
    </form>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {loading ? <p role="status">Loading documents…</p> : shown.length ? <ul>{shown.map(document => <li key={document.id}>
      <span>{document.file_name} · {document.doc_type.replace(/_/g, ' ')} · {new Date(document.created_at).toLocaleDateString()}</span>{' '}
      <button type="button" className="crm-text-btn" onClick={() => void download(document)}>Download {document.file_name}</button>
    </li>)}</ul> : <p>No documents uploaded.</p>}
    <button type="button" className="crm-text-btn" disabled={busy} onClick={() => { setError(''); setAttempt(value => value + 1) }}>Refresh documents</button>
  </section>
}
