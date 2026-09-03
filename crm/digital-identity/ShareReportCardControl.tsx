import { useMemo, useState } from 'react'
import {
  buildReportCardSharePath,
  isReportCardShareType,
  REPORT_CARD_SHARE_LABELS,
  REPORT_CARD_SHARE_TYPES,
  reportCardShareSideEffects,
  type ReportCardShareType,
} from '../../modules/digital-identity'

type ShareReportCardControlProps = {
  publicKey: string
  onCopied?: (message: string) => void
  onCopyFailed?: (message: string) => void
}

export function shareReportCardControlSideEffects() {
  return {
    ...reportCardShareSideEffects(),
    downloadsQr: false,
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

export default function ShareReportCardControl({
  publicKey,
  onCopied,
  onCopyFailed,
}: ShareReportCardControlProps) {
  const [reportCardType, setReportCardType] = useState<ReportCardShareType>('family')
  const sharePath = useMemo(
    () => buildReportCardSharePath(publicKey, reportCardType),
    [publicKey, reportCardType],
  )

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

  return (
    <div className="crm-digital-card-share" data-testid="crm-share-report-card">
      <h3 className="crm-digital-card-profile-title">Share a Report Card</h3>
      <p className="crm-muted">
        Copy a personal landing link. Attribution uses your Digital Identity public key only.
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
      </div>
    </div>
  )
}
