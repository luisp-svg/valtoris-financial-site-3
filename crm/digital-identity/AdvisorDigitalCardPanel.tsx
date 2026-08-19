import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  downloadPublicCardQr,
  qrDownloadErrorCopy,
  qrDownloadMenuItems,
  triggerQrBrowserDownload,
} from '../../components/digitalIdentity/downloadPublicCardQr'
import {
  normalizePublicHref,
  type PublicCardQrFormat,
} from '../../modules/digital-identity'
import {
  loadOwnDigitalCard,
  publishOwnDigitalCard,
  updateOwnAdvisorPublicProfile,
  type OwnAdvisorIdentity,
  type OwnDigitalCard,
} from './cardsApi'

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
  const [identity, setIdentity] = useState<OwnAdvisorIdentity | null>(null)
  const [card, setCard] = useState<OwnDigitalCard | null>(null)
  const [qrObjectUrl, setQrObjectUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [photoDraft, setPhotoDraft] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await loadOwnDigitalCard(supabase, userId)
    if (!result.ok) {
      setError(result.message)
      setMissingIdentity(false)
      setIdentity(null)
      setCard(null)
      setLoading(false)
      return
    }
    setMissingIdentity(result.identity === null)
    setIdentity(result.identity)
    setPhoneDraft(result.identity?.phone ?? '')
    setPhotoDraft(result.identity?.photoUrl ?? '')
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
    await load()
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setError(null)
    setMessage(null)
    const result = await updateOwnAdvisorPublicProfile(supabase, userId, {
      phone: phoneDraft,
      photoUrl: photoDraft,
    })
    setSavingProfile(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setIdentity(result.identity)
    setPhoneDraft(result.identity.phone ?? '')
    setPhotoDraft(result.identity.photoUrl ?? '')
    setMessage('Public photo and phone saved. The permanent QR did not change.')
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

      {!loading && identity ? (
        <form className="crm-form" onSubmit={(event) => void handleSaveProfile(event)}>
          <h3 className="crm-digital-card-profile-title">Public phone and photo</h3>
          <p className="crm-muted">
            These fields live on your advisor profile. Saving them does not change the permanent QR.
            Call and Text appear on the public card only when a phone number is present. Photo must
            be a durable https URL; leave blank to use initials.
          </p>
          <label>
            Public phone
            <input
              type="tel"
              autoComplete="tel"
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value)}
              placeholder="Include area code"
            />
          </label>
          <label>
            Public photo URL
            <input
              type="url"
              value={photoDraft}
              onChange={(event) => setPhotoDraft(event.target.value)}
              placeholder="https://"
            />
          </label>
          {normalizePublicHref(photoDraft) ? (
            <img
              className="crm-digital-card-photo-preview"
              src={normalizePublicHref(photoDraft) ?? undefined}
              alt=""
              width={96}
              height={96}
            />
          ) : null}
          <div className="platform-btn-row">
            <button
              type="submit"
              className="platform-btn platform-btn-primary"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving…' : 'Save phone and photo'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
