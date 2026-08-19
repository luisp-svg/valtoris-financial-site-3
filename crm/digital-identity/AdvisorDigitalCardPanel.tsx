import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  downloadPublicCardQr,
  qrDownloadErrorCopy,
  qrDownloadMenuItems,
  triggerQrBrowserDownload,
} from '../../components/digitalIdentity/downloadPublicCardQr'
import type { PublicCardQrFormat } from '../../modules/digital-identity'
import { loadOwnDigitalCard, publishOwnDigitalCard, type OwnDigitalCard } from './cardsApi'

type AdvisorDigitalCardPanelProps = {
  supabase: SupabaseClient
  userId: string
  onPublished?: () => void
}

export default function AdvisorDigitalCardPanel({
  supabase,
  userId,
  onPublished,
}: AdvisorDigitalCardPanelProps) {
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [missingIdentity, setMissingIdentity] = useState(false)
  const [card, setCard] = useState<OwnDigitalCard | null>(null)
  const [qrObjectUrl, setQrObjectUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await loadOwnDigitalCard(supabase, userId)
    if (!result.ok) {
      setError(result.message)
      setMissingIdentity(false)
      setCard(null)
      setLoading(false)
      return
    }
    setMissingIdentity(result.identity === null)
    setCard(result.card)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!card || card.status !== 'published') {
      setQrObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()
    setQrLoading(true)

    void (async () => {
      const result = await downloadPublicCardQr(
        { key: card.publicKey, format: 'svg' },
        { signal: controller.signal },
      )
      if (cancelled) return
      setQrLoading(false)
      if (!result.ok) {
        setError(qrDownloadErrorCopy(result.code))
        return
      }
      if (
        result.destinationUrl &&
        result.destinationUrl.includes('/c/') &&
        !result.destinationUrl.includes('/c/k/')
      ) {
        setError('Unable to display QR.')
        return
      }
      const objectUrl = URL.createObjectURL(result.blob)
      setQrObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return objectUrl
      })
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [card])

  useEffect(() => {
    return () => {
      if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl)
    }
  }, [qrObjectUrl])

  async function handlePublish() {
    setPublishing(true)
    setError(null)
    setMessage(null)
    const result = await publishOwnDigitalCard(supabase, userId)
    setPublishing(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setCard(result.card)
    setMessage('Digital card published. The QR URL stays the same if contact details change.')
    onPublished?.()
  }

  async function copyCardUrl() {
    if (!card) return
    const absolute = `${window.location.origin}${card.cardPath}`
    try {
      await navigator.clipboard.writeText(absolute)
      setMessage('Card URL copied.')
    } catch {
      setError('Unable to copy card URL.')
    }
  }

  async function downloadQr(format: PublicCardQrFormat) {
    if (!card) return
    setError(null)
    const result = await downloadPublicCardQr({ key: card.publicKey, format })
    if (!result.ok) {
      setError(result.message)
      return
    }
    if (
      result.destinationUrl &&
      result.destinationUrl.includes('/c/') &&
      !result.destinationUrl.includes('/c/k/')
    ) {
      setError('Unable to download QR.')
      return
    }
    const saved = triggerQrBrowserDownload(result.blob, result.filename)
    if (!saved) {
      setError(qrDownloadErrorCopy('malformed_response'))
      return
    }
    const label =
      format === 'png-hires' ? 'Print PNG' : format === 'png' ? 'PNG' : 'SVG'
    setMessage(`Permanent QR (${label}) downloaded.`)
  }

  return (
    <section className="crm-panel" aria-labelledby="crm-digital-card-title">
      <h2 id="crm-digital-card-title">Your digital card</h2>
      <p className="crm-muted">
        Permanent QR codes point at a Valtoris URL, not your phone or email. Profile changes do not
        require a reprint.
      </p>

      {error ? (
        <p className="crm-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="crm-success" role="status">
          {message}
        </p>
      ) : null}

      {loading ? <p className="crm-muted">Loading digital card…</p> : null}

      {!loading && missingIdentity ? (
        <p className="crm-muted">
          An advisor identity is required before a public card can be published. Contact an owner
          if you do not have one.
        </p>
      ) : null}

      {!loading && !missingIdentity && (!card || card.status !== 'published') ? (
        <div className="platform-btn-row">
          <button
            type="button"
            className="platform-btn platform-btn-primary"
            onClick={() => void handlePublish()}
            disabled={publishing}
          >
            {publishing ? 'Publishing…' : card ? 'Publish digital card' : 'Create and publish card'}
          </button>
        </div>
      ) : null}

      {!loading && card?.status === 'published' ? (
        <div className="crm-digital-card">
          <div className="crm-digital-card-qr-wrap">
            {qrLoading && !qrObjectUrl ? (
              <p className="crm-muted">Preparing QR…</p>
            ) : null}
            {qrObjectUrl ? (
              <img
                className="crm-digital-card-qr"
                src={qrObjectUrl}
                alt={`Permanent QR for ${card.displayName}`}
                width={200}
                height={200}
              />
            ) : null}
          </div>
          <div className="crm-digital-card-meta">
            <p>
              <strong>{card.displayName}</strong>
            </p>
            <p className="crm-muted" data-testid="crm-digital-card-path">
              {card.cardPath}
            </p>
            <p className="crm-muted">Public key stays fixed. Slug may change later without breaking this QR.</p>
            <div className="platform-btn-row">
              <a
                className="platform-btn platform-btn-secondary"
                href={card.cardPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open card
              </a>
              <button
                type="button"
                className="platform-btn platform-btn-secondary"
                onClick={() => void copyCardUrl()}
              >
                Copy URL
              </button>
              {qrDownloadMenuItems().map((item) => (
                <button
                  key={item.format}
                  type="button"
                  className="platform-btn platform-btn-outline"
                  onClick={() => void downloadQr(item.format)}
                >
                  QR {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
