/**
 * Friendly “How We Met” formatting for Digital Identity attribution.
 * Never surfaces advisor_notes, raw JSON, campaign UUIDs, or full referrer URLs.
 */

export type HowWeMetInput = {
  originalCampaign?: string | null
  originalSourceMetadata?: Record<string, unknown> | null
  submittedAt?: string | null
  cardOwnerName?: string | null
  sourcePage?: string | null
  hasRelationshipPhoto?: boolean
}

export type HowWeMetViewModel = {
  campaignLabel: string | null
  campaignCode: string | null
  eventLabel: string | null
  eventCode: string | null
  sourceChannel: string | null
  connectedDate: string | null
  cardOwner: string | null
  relationshipPhoto: 'present' | 'none'
  sourcePage: string | null
  utmSummary: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function formatSourceChannel(value: string | null): string | null {
  if (!value) return null
  const map: Record<string, string> = {
    link: 'Link',
    qr: 'QR code',
    nfc: 'NFC',
    share: 'Share',
    unknown: 'Unknown',
  }
  return map[value.toLowerCase()] || value
}

function formatConnectedDate(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms))
}

function formatUtmSummary(meta: Record<string, unknown>): string | null {
  const utms = asRecord(meta.utms)
  const parts = [
    readString(utms, 'utmSource', 'utm_source') &&
      `source=${readString(utms, 'utmSource', 'utm_source')}`,
    readString(utms, 'utmMedium', 'utm_medium') &&
      `medium=${readString(utms, 'utmMedium', 'utm_medium')}`,
    readString(utms, 'utmCampaign', 'utm_campaign') &&
      `campaign=${readString(utms, 'utmCampaign', 'utm_campaign')}`,
    readString(utms, 'utmContent', 'utm_content') &&
      `content=${readString(utms, 'utmContent', 'utm_content')}`,
    readString(utms, 'utmTerm', 'utm_term') && `term=${readString(utms, 'utmTerm', 'utm_term')}`,
  ].filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Derive a How We Met view from household timeline/activity metadata
 * (campaign attribution activities only — never raw JSON dumps).
 */
export function buildHowWeMetFromActivities(
  activities: Array<{
    occurred_at?: string
    metadata?: Record<string, unknown> | null
  }>,
  extras: Omit<HowWeMetInput, 'originalCampaign' | 'originalSourceMetadata' | 'submittedAt'> = {},
): HowWeMetViewModel | null {
  const attributed = activities.find((activity) => {
    const meta = asRecord(activity.metadata)
    const key = readString(meta, 'eventKey', 'event')
    return (
      key === 'digital_identity.campaign_attributed' ||
      key === 'digital_identity.relationship_connected_at_event' ||
      key === 'digital_identity.event_attributed'
    )
  })
  if (!attributed) return null
  const meta = asRecord(attributed.metadata)
  return buildHowWeMetViewModel({
    originalCampaign: readString(meta, 'campaignCode', 'campaign_code'),
    originalSourceMetadata: meta,
    submittedAt: attributed.occurred_at ?? null,
    ...extras,
  })
}

export function buildHowWeMetViewModel(input: HowWeMetInput): HowWeMetViewModel | null {
  const meta = asRecord(input.originalSourceMetadata)
  const campaignCode =
    (typeof input.originalCampaign === 'string' && input.originalCampaign.trim()) ||
    readString(meta, 'campaignCode', 'campaign_code')
  const campaignLabel = readString(meta, 'campaignLabel', 'campaign_label') || campaignCode
  const eventCode = readString(meta, 'eventCode', 'event_code')
  const eventLabel = readString(meta, 'eventLabel', 'event_label') || eventCode
  const sourceChannel = formatSourceChannel(readString(meta, 'sourceChannel', 'source_channel'))
  const connectedDate = formatConnectedDate(input.submittedAt ?? null)
  const sourcePage =
    (typeof input.sourcePage === 'string' && input.sourcePage.trim()) ||
    readString(meta, 'sourcePage', 'source_page')
  const utmSummary = formatUtmSummary(meta)
  const cardOwner =
    (typeof input.cardOwnerName === 'string' && input.cardOwnerName.trim()) || null

  const hasSignal = Boolean(
    campaignCode ||
      eventCode ||
      sourceChannel ||
      connectedDate ||
      sourcePage ||
      utmSummary ||
      input.hasRelationshipPhoto,
  )
  if (!hasSignal) return null

  return {
    campaignLabel: campaignLabel || null,
    campaignCode: campaignCode || null,
    eventLabel: eventLabel || null,
    eventCode: eventCode || null,
    sourceChannel,
    connectedDate,
    cardOwner,
    relationshipPhoto: input.hasRelationshipPhoto ? 'present' : 'none',
    sourcePage: sourcePage || null,
    utmSummary,
  }
}
