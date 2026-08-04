import { useState } from 'react'

type RelationshipPhotoViewerProps = {
  documentId: string
  onRemoved?: () => void
  canRemove?: boolean
}

/**
 * Loads a short-lived signed URL for a Relationship Photo after CRM auth.
 * Never displays raw storage paths.
 */
export default function RelationshipPhotoViewer({
  documentId,
  onRemoved,
  canRemove = false,
}: RelationshipPhotoViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function load() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/crm/documents/signed-url?documentId=${encodeURIComponent(documentId)}`,
        { credentials: 'same-origin' },
      )
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        url?: string
        error?: string
      }
      if (!response.ok || json.ok !== true || typeof json.url !== 'string') {
        setError(json.error || 'Unable to open Relationship Photo.')
        setUrl(null)
        return
      }
      setUrl(json.url)
    } catch {
      setError('Unable to open Relationship Photo.')
      setUrl(null)
    } finally {
      setLoading(false)
    }
  }

  async function removePhoto() {
    if (!canRemove || removing) return
    setRemoving(true)
    setError(null)
    try {
      const response = await fetch('/api/crm/documents/relationship-photo', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || json.ok !== true) {
        setError(json.error || 'Unable to remove Relationship Photo.')
        return
      }
      setUrl(null)
      onRemoved?.()
    } catch {
      setError('Unable to remove Relationship Photo.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="crm-relationship-photo">
      {url ? <img src={url} alt="Relationship Photo" /> : null}
      <div className="crm-inline-actions">
        <button type="button" className="platform-btn platform-btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : url ? 'Refresh view' : 'View photo'}
        </button>
        {canRemove ? (
          <button
            type="button"
            className="platform-btn platform-btn-outline"
            onClick={() => void removePhoto()}
            disabled={removing}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
