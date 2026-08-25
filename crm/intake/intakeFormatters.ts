import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import {
  CRM_PRODUCT_LABEL_BY_ASSESSMENT,
  crmProductLabelForAssessment,
  crmProductLabelForLeadType,
  isPublicReportCardAssessmentType,
} from '../../modules/reportCard/publicIngestCatalog'
import type {
  DuplicateReviewStatus,
  IngestMatchStatus,
  IntakeConsentSummary,
  IntakeDiagnosticSummary,
  IntakeDigitalIdentitySummary,
  IntakeFilterId,
  IntakeQueueCounts,
  IntakeQueueItem,
  LeadStatus,
  SheetsSyncStatus,
} from './types'

export function isDigitalIdentityLead(item: Pick<IntakeQueueItem, 'leadType'>): boolean {
  return item.leadType === DIGITAL_IDENTITY_LEAD_TYPE
}

export function intakeProductLabel(item: Pick<IntakeQueueItem, 'leadType' | 'digitalIdentity' | 'diagnostic'>): string {
  if (isDigitalIdentityLead(item)) {
    return item.digitalIdentity?.productLabel ?? 'Digital Identity'
  }
  if (item.diagnostic?.productLabel) return item.diagnostic.productLabel
  return asIntakeDiagnosticProductLabel(crmProductLabelForLeadType(item.leadType))
}

function asIntakeDiagnosticProductLabel(value: string): IntakeDiagnosticSummary['productLabel'] {
  for (const label of Object.values(CRM_PRODUCT_LABEL_BY_ASSESSMENT)) {
    if (value === label) return label
  }
  return 'Initial Financial Diagnostic'
}

export function parseConsentSnapshot(value: unknown): IntakeConsentSummary {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    assessmentStorageAcknowledged: record.assessmentStorageAcknowledged === true,
    contactPermission: record.contactPermission === true,
    emailMarketingConsent: record.emailMarketingConsent === true,
    smsMarketingConsent: record.smsMarketingConsent === true,
    privacyAcknowledged: record.privacyAcknowledged === true,
    consentVersion: typeof record.consentVersion === 'string' ? record.consentVersion : null,
    consentedAt: typeof record.consentedAt === 'string' ? record.consentedAt : null,
  }
}

export function mapSheetsSyncLabel(status: SheetsSyncStatus | null): string {
  switch (status) {
    case 'succeeded':
      return 'Synced'
    case 'failed':
      return 'Sync issue'
    case 'pending':
      return 'Pending'
    case 'skipped':
      return 'Not required'
    default:
      return '—'
  }
}

export function mapMatchStatusLabel(status: IngestMatchStatus | null): string {
  switch (status) {
    case 'exact_trusted_match':
      return 'Matched to existing household'
    case 'possible_match':
      return 'Possible duplicate'
    case 'new_prospect':
      return 'New prospect'
    default:
      return 'Unclassified'
  }
}

export function mapMatchReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    email_and_phone_match: 'Email and phone matched',
    email_only_match: 'Email matched',
    phone_only_match: 'Phone matched',
    multiple_exact_contact_matches: 'Multiple households matched the same contact details',
    multiple_partial_contact_matches: 'Multiple possible households',
    exact_contact_name_conflict: 'Contact matched but the name differed',
    email_and_phone_partial_match: 'Shared contact information',
    no_candidates_found: 'No existing household matched',
    unclassified_candidate_overlap: 'Incomplete identity information',
    possible_contact_match: 'Possible shared contact information',
  }
  return map[reason] ?? reason.replace(/_/g, ' ')
}

export function isNeedsReview(item: IntakeQueueItem): boolean {
  if (isResolvedIntake(item)) return false
  if (item.ingestMatchStatus === 'possible_match') return true
  if (item.duplicateReview?.status === 'pending') return true
  if (item.duplicateReviewStatus === 'pending') return true
  return false
}

export function isResolvedIntake(item: IntakeQueueItem): boolean {
  const reviewStatus = item.duplicateReview?.status ?? item.duplicateReviewStatus
  return (
    reviewStatus === 'confirmed_unique' ||
    reviewStatus === 'merged' ||
    reviewStatus === 'dismissed'
  )
}

export function matchesIntakeFilter(
  item: IntakeQueueItem,
  filter: IntakeFilterId,
  currentAdvisorProfileId: string | null,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'needs_review':
      return isNeedsReview(item)
    case 'new_prospects':
      return item.ingestMatchStatus === 'new_prospect'
    case 'exact_matches':
      return item.ingestMatchStatus === 'exact_trusted_match'
    case 'possible_duplicates':
      return item.ingestMatchStatus === 'possible_match' || item.duplicateReviewStatus === 'pending'
    case 'resolved':
      return isResolvedIntake(item)
    case 'unassigned':
      return !item.assignedAdvisor
    case 'assigned_to_me':
      return Boolean(
        currentAdvisorProfileId && item.assignedAdvisor?.id === currentAdvisorProfileId,
      )
    case 'sheets_failed':
      return item.sheetsSyncStatus === 'failed'
    default:
      return true
  }
}

export function buildIntakeCounts(
  items: readonly IntakeQueueItem[],
  currentAdvisorProfileId: string | null,
): IntakeQueueCounts {
  const filters: IntakeFilterId[] = [
    'all',
    'needs_review',
    'new_prospects',
    'exact_matches',
    'possible_duplicates',
    'resolved',
    'unassigned',
    'assigned_to_me',
    'sheets_failed',
  ]
  const counts = {} as IntakeQueueCounts
  for (const filter of filters) {
    counts[filter] = items.filter((item) =>
      matchesIntakeFilter(item, filter, currentAdvisorProfileId),
    ).length
  }
  return counts
}

export function sortIntakeNewestFirst(items: IntakeQueueItem[]): IntakeQueueItem[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.submittedAt)
    const bTime = Date.parse(b.submittedAt)
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1
    return bTime - aTime
  })
}

export function normalizeLeadStatus(value: unknown): LeadStatus {
  const allowed: LeadStatus[] = [
    'new',
    'unassigned',
    'assigned',
    'converted',
    'closed_lost',
    'duplicate_review',
  ]
  return typeof value === 'string' && (allowed as string[]).includes(value)
    ? (value as LeadStatus)
    : 'new'
}

export function normalizeMatchStatus(value: unknown): IngestMatchStatus | null {
  if (
    value === 'exact_trusted_match' ||
    value === 'possible_match' ||
    value === 'new_prospect'
  ) {
    return value
  }
  return null
}

export function normalizeDuplicateReviewStatus(value: unknown): DuplicateReviewStatus {
  if (
    value === 'none' ||
    value === 'pending' ||
    value === 'confirmed_unique' ||
    value === 'merged' ||
    value === 'dismissed'
  ) {
    return value
  }
  return 'none'
}

export function normalizeSheetsSyncStatus(value: unknown): SheetsSyncStatus | null {
  if (value === 'pending' || value === 'succeeded' || value === 'failed' || value === 'skipped') {
    return value
  }
  return null
}

export function buildDiagnosticFromAssessmentRow(
  row: Record<string, unknown> | null | undefined,
  leadScore: number | null,
  leadGrade: string | null,
  leadPriorities: unknown,
  leadType?: string,
): IntakeDiagnosticSummary | null {
  if (!row || typeof row.id !== 'string') return null

  const derived =
    row.derived_metrics && typeof row.derived_metrics === 'object' && !Array.isArray(row.derived_metrics)
      ? (row.derived_metrics as Record<string, unknown>)
      : {}

  const categoriesRaw = Array.isArray(derived.categories) ? derived.categories : []
  const categories = categoriesRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const cat = entry as Record<string, unknown>
      return {
        id: typeof cat.id === 'string' ? cat.id : 'category',
        title: typeof cat.title === 'string' ? cat.title : 'Category',
        score: typeof cat.score === 'number' ? cat.score : null,
        grade: typeof cat.grade === 'string' ? cat.grade : null,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value != null)

  const prioritiesFromAssessment = Array.isArray(row.priorities) ? row.priorities : []
  const prioritiesFromLead = Array.isArray(leadPriorities) ? leadPriorities : []
  const prioritySource =
    prioritiesFromAssessment.length > 0 ? prioritiesFromAssessment : prioritiesFromLead

  const topPriorities = prioritySource
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (entry && typeof entry === 'object' && typeof (entry as { title?: unknown }).title === 'string') {
        return String((entry as { title: string }).title)
      }
      return null
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 5)

  const overallScore =
    typeof row.overall_score === 'number'
      ? row.overall_score
      : row.overall_score == null
        ? leadScore
        : Number(row.overall_score)

  const overallGradeRaw =
    typeof row.overall_grade === 'string' ? row.overall_grade : leadGrade
  const overallGrade = overallGradeRaw && overallGradeRaw.trim() ? overallGradeRaw : null
  const fromLead = crmProductLabelForLeadType(leadType ?? '')
  const fromAssessment = isPublicReportCardAssessmentType(row.assessment_type)
    ? crmProductLabelForAssessment(row.assessment_type)
    : null
  const typedLabel = asIntakeDiagnosticProductLabel(fromLead || fromAssessment || '')

  const netProtectionGap =
    typeof derived.netProtectionGap === 'number' && Number.isFinite(derived.netProtectionGap)
      ? derived.netProtectionGap
      : null
  const totalNeed =
    typeof derived.totalNeed === 'number' && Number.isFinite(derived.totalNeed)
      ? derived.totalNeed
      : null
  const currentProtection =
    typeof derived.currentProtection === 'number' && Number.isFinite(derived.currentProtection)
      ? derived.currentProtection
      : null
  const protectionGapFormatted =
    typeof derived.protectionGapFormatted === 'string' && derived.protectionGapFormatted.trim()
      ? derived.protectionGapFormatted
      : null

  return {
    assessmentId: row.id,
    overallScore: Number.isFinite(overallScore as number) ? (overallScore as number) : null,
    overallGrade,
    categories,
    topPriorities,
    captureChannel:
      typeof row.capture_channel === 'string' ? row.capture_channel : 'unknown',
    scoringVersion:
      typeof row.scoring_version === 'number' ? row.scoring_version : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    productLabel: typedLabel,
    assessmentType: typeof row.assessment_type === 'string' ? row.assessment_type : null,
    protectionGapFormatted,
    netProtectionGap,
    totalNeed,
    currentProtection,
  }
}

export function extractSubmittedIdentity(rawPayload: unknown): {
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
} {
  const record =
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {}

  const firstName =
    typeof record.firstName === 'string'
      ? record.firstName.trim()
      : typeof record.first_name === 'string'
        ? record.first_name.trim()
        : ''
  const lastName =
    typeof record.lastName === 'string'
      ? record.lastName.trim()
      : typeof record.last_name === 'string'
        ? record.last_name.trim()
        : ''
  const fullName =
    typeof record.fullName === 'string' && record.fullName.trim()
      ? record.fullName.trim()
      : [firstName, lastName].filter(Boolean).join(' ')
  const email =
    typeof record.email === 'string' && record.email.trim() ? record.email.trim() : null
  const phone =
    typeof record.phone === 'string' && record.phone.trim() ? record.phone.trim() : null

  return { firstName, lastName, fullName, email, phone }
}

function readMetaString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * Digital Identity ingest stores allowlisted extras in raw_payload /
 * original_source_metadata (company, reason, note, etc.) — not contact fields.
 */
export function extractDigitalIdentitySnapshot(input: {
  leadType: string
  rawPayload: unknown
  sourceMetadata: Record<string, unknown>
  originalCampaign: string | null
  originalAdvisorSlug: string | null
  relationshipPhoto?: IntakeDigitalIdentitySummary['relationshipPhoto']
}): IntakeDigitalIdentitySummary | null {
  if (input.leadType !== DIGITAL_IDENTITY_LEAD_TYPE) return null

  const raw =
    input.rawPayload && typeof input.rawPayload === 'object' && !Array.isArray(input.rawPayload)
      ? (input.rawPayload as Record<string, unknown>)
      : {}
  const meta = input.sourceMetadata

  return {
    company: readMetaString(raw, 'company') ?? readMetaString(meta, 'company'),
    title: readMetaString(raw, 'title') ?? readMetaString(meta, 'title'),
    reason:
      readMetaString(raw, 'reason', 'reasonForConnecting') ??
      readMetaString(meta, 'reason', 'reasonForConnecting'),
    note: readMetaString(raw, 'note') ?? readMetaString(meta, 'note'),
    preferredFollowUp:
      readMetaString(raw, 'preferredFollowUp', 'preferredFollowUpMethod') ??
      readMetaString(meta, 'preferredFollowUp', 'preferredFollowUpMethod'),
    cardPublicKey:
      readMetaString(raw, 'cardPublicKey', 'card_public_key') ??
      readMetaString(meta, 'cardPublicKey', 'card_public_key'),
    cardSlug:
      readMetaString(raw, 'cardSlug', 'card_slug') ??
      readMetaString(meta, 'cardSlug', 'card_slug'),
    advisorSlug:
      input.originalAdvisorSlug ??
      readMetaString(raw, 'advisorSlug', 'advisor_slug') ??
      readMetaString(meta, 'advisorSlug', 'advisor_slug'),
    campaignCode:
      input.originalCampaign ??
      readMetaString(raw, 'campaignCode', 'campaign_code') ??
      readMetaString(meta, 'campaignCode', 'campaign_code'),
    eventCode:
      readMetaString(raw, 'eventCode', 'event_code') ??
      readMetaString(meta, 'eventCode', 'event_code'),
    relationshipPhoto: input.relationshipPhoto ?? null,
    productLabel: 'Digital Identity',
  }
}

/**
 * Resolve submitted contact for queue display.
 * Family leads keep identity in raw_payload; Digital Identity falls back to
 * household + normalized lead contact fields.
 */
export function resolveIntakeSubmittedContact(input: {
  rawPayload: unknown
  leadType: string
  householdDisplayName: string | null
  householdEmail: string | null
  householdPhone: string | null
  normalizedEmail: string | null
  normalizedPhone: string | null
}): {
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
} {
  const submitted = extractSubmittedIdentity(input.rawPayload)
  const fullName =
    submitted.fullName ||
    input.householdDisplayName?.trim() ||
    'Prospect'
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const firstName = submitted.firstName || nameParts[0] || ''
  const lastName =
    submitted.lastName ||
    (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')

  const preferHouseholdContact =
    input.leadType === DIGITAL_IDENTITY_LEAD_TYPE &&
    !submitted.email &&
    !submitted.phone

  return {
    firstName,
    lastName,
    fullName,
    email:
      submitted.email ??
      input.normalizedEmail ??
      (preferHouseholdContact ? input.householdEmail : null),
    phone:
      submitted.phone ??
      input.normalizedPhone ??
      (preferHouseholdContact ? input.householdPhone : null),
  }
}
