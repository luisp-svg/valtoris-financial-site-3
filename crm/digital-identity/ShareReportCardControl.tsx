import { useEffect, useMemo, useState } from 'react'
import {
  downloadPublicCardQr,
  qrDownloadErrorCopy,
  triggerQrBrowserDownload,
} from '../../components/digitalIdentity/downloadPublicCardQr'
import {
  buildReportCardSharePath,
  isAllowedQrDestination,
  isReportCardShareType,
  REPORT_CARD_SHARE_LABELS,
  REPORT_CARD_SHARE_TYPES,
  reportCardShareSideEffects,
  type PublicCardQrFormat,
  type ReportCardShareType,
} from '../../modules/digital-identity'

type ShareReportCardControlProps = {
  publicKey: string
  onCopied?: (message: string) => void
  onCopyFailed?: (message: string) => void
}

const SHARE_QR_DOWNLOAD_FORMATS: readonly { format: Exclude<PublicCardQrFormat, 'png-hires'>; label: string }[] =
  [
    { format: 'svg', label: 'SVG' },
    { format: 'png', label: 'PNG' },
  ]

export function shareReportCardControlSideEffects() {
  return {
    ...reportCardShareSideEffects(),
    downloadsQr: true,
    writesCampaigns: false,
  }
}

export async function copyReportCardShareLink(
  origin: string,
  sharePath: string,
  writeText: (text: string) => Promise<void> = (text) => navigator.clipboard.writeText(text),
): Promise<string | null> {
  const trimmedOrigin = origin.trim().replace(/\/$/, '')
  if (!trimmedOrigin || !sharePath.startsWith('/')) return null
  const absolute = `${trimmedOrigin}${sharePath}`
  await writeText(absolute)
  return absolute
}

export function isSafeReportCardQrDestination(
  destinationUrl: string | null,
  publicKey: string,
  origin: string,
): boolean {
  if (!destinationUrl) return false
  return isAllowedQrDestination(destinationUrl, publicKey, { origin })
}

export default function ShareReportCardControl({
  publicKey,
  onCopied,
  onCopyFailed,
}: ShareReportCardControlProps) {
  const [reportCardType, setReportCardType] = useState<ReportCardShareType>('family')
  const [qrObjectUrl, setQrObjectUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const sharePath = useMemo(
    () => buildReportCardSharePath(publicKey, reportCardType),
    [publicKey, reportCardType],
  )

  useEffect(() => {
    if (!sharePath) {
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
        { key: publicKey, format: 'svg', reportCardType },
        { signal: controller.signal },
      )
      if (cancelled) return
      setQrLoading(false)
      if (!result.ok) return
      if (
        !isSafeReportCardQrDestination(
          result.destinationUrl,
          publicKey,
          window.location.origin,
        )
      ) {
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
  }, [publicKey, reportCardType, sharePath])

  useEffect(() => {
    return () => {
      if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl)
    }
  }, [qrObjectUrl])

  async function copyShareLink() {
    if (!sharePath) {
      onCopyFailed?.('Unable to copy Report Card link.')
      return
    }
    try {
      const copied = await copyReportCardShareLink(window.location.origin, sharePath)
      if (!copied) {
        onCopyFailed?.('Unable to copy Report Card link.')
        return
      }
      onCopied?.('Report Card link copied.')
    } catch {
      onCopyFailed?.('Unable to copy Report Card link.')
    }
  }

  async function downloadShareQr(format: Exclude<PublicCardQrFormat, 'png-hires'>) {
    if (!sharePath) {
      onCopyFailed?.('Unable to download Report Card QR.')
      return
    }
    const result = await downloadPublicCardQr({
      key: publicKey,
      format,
      reportCardType,
    })
    if (!result.ok) {
      onCopyFailed?.(qrDownloadErrorCopy(result.code))
      return
    }
    if (
      !isSafeReportCardQrDestination(result.destinationUrl, publicKey, window.location.origin)
    ) {
      onCopyFailed?.('Unable to download Report Card QR.')
      return
    }
    const saved = triggerQrBrowserDownload(result.blob, result.filename)
    if (!saved) {
      onCopyFailed?.('Unable to download Report Card QR.')
      return
    }
    onCopied?.(`Report Card QR (${format === 'png' ? 'PNG' : 'SVG'}) downloaded.`)
  }

  return (
    <div className="crm-digital-card-share" data-testid="crm-share-report-card">
      <h3 className="crm-digital-card-profile-title">Share a Report Card</h3>
      <p className="crm-muted">
        Copy a personal landing link or download a QR. Attribution uses your Digital Identity
        public key only.
      </p>
      <label>
        Report Card
        <select
          data-testid="crm-share-report-card-type"
          value={reportCardType}
          onChange={(event) => {
            const next = event.target.value
            if (isReportCardShareType(next)) setReportCardType(next)
          }}
        >
          {REPORT_CARD_SHARE_TYPES.map((type) => (
            <option key={type} value={type}>
              {REPORT_CARD_SHARE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <p className="crm-muted" data-testid="crm-share-report-card-url">
        {sharePath ?? 'A published digital card is required to generate a share link.'}
      </p>
      {qrLoading && !qrObjectUrl ? (
        <p className="crm-muted">Preparing QR…</p>
      ) : null}
      {qrObjectUrl ? (
        <img
          className="crm-digital-card-share-qr"
          data-testid="crm-share-report-card-qr"
          src={qrObjectUrl}
          alt={`${REPORT_CARD_SHARE_LABELS[reportCardType]} Report Card QR`}
          width={160}
          height={160}
        />
      ) : null}
      <div className="platform-btn-row">
        <button
          type="button"
          className="platform-btn platform-btn-secondary"
          data-testid="crm-share-report-card-copy"
          onClick={() => void copyShareLink()}
          disabled={!sharePath}
        >
          Copy link
        </button>
        {SHARE_QR_DOWNLOAD_FORMATS.map((item) => (
          <button
            key={item.format}
            type="button"
            className="platform-btn platform-btn-outline"
            data-testid={`crm-share-report-card-qr-${item.format}`}
            onClick={() => void downloadShareQr(item.format)}
            disabled={!sharePath}
          >
            QR {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
