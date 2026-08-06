import { contactCategoryLabel, isContactCategory } from './categoryLabels'
import { formatPhoneForDisplay } from './validation'
import type {
  CollisionCreateResult,
  ContactConsentSummary,
  ContactDetail,
  ContactFormValues,
  ContactListItem,
  DuplicateMatch,
  DuplicatePreviewResult,
  QuickAddCreateResult,
  QuickAddUpdateResult,
} from './types'

function asSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return (value as T) ?? null
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t ? t : null
}

function locationLabel(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`
  return city || state
}

const MATCH_CLASS_LABELS: Record<string, string> = {
  exact_email: 'Same email',
  exact_phone: 'Same phone',
  exact_email_and_phone: 'Same email and phone',
  name_company: 'Same name and company',
  conflicting_identifiers: 'Conflicting email/phone across contacts',
}

export function matchClassLabel(value: string | null | undefined): string {
  if (!value) return 'Possible match'
  return MATCH_CLASS_LABELS[value] ?? 'Possible match'
}

export function mapConsentSummary(raw: unknown): ContactConsentSummary {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const consentedAt = str(row.consentedAt)
  const consentVersion = str(row.consentVersion)
  const contactPermission = row.contactPermission === true
  const emailMarketingConsent = row.emailMarketingConsent === true
  const smsMarketingConsent = row.smsMarketingConsent === true
  const privacyAcknowledged = row.privacyAcknowledged === true
  const evidenceDescription = str(row.evidenceDescription)
  const hasConsent = Boolean(consentedAt && consentVersion)
  const channels: string[] = []
  if (contactPermission) channels.push('contact')
  if (emailMarketingConsent) channels.push('email')
  if (smsMarketingConsent) channels.push('SMS')
  const summaryLabel = hasConsent
    ? `Consent recorded${channels.length ? ` (${channels.join(', ')})` : ''}`
    : 'No consent recorded'
  return {
    privacyAcknowledged,
    contactPermission,
    emailMarketingConsent,
    smsMarketingConsent,
    consentVersion,
    consentedAt,
    evidenceDescription,
    hasConsent,
    summaryLabel,
  }
}

function primaryMember(members: unknown): Record<string, unknown> | null {
  if (!Array.isArray(members)) return null
  const active = members.filter(
    (m) => m && typeof m === 'object' && (m as { deleted_at?: unknown }).deleted_at == null,
  ) as Record<string, unknown>[]
  return (
    active.find((m) => m.is_primary_contact === true) ??
    active[0] ??
    null
  )
}

export function mapContactListItem(row: Record<string, unknown>): ContactListItem | null {
  const leadId = str(row.id)
  const household = asSingle<Record<string, unknown>>(row.household)
  if (!leadId || !household) return null
  if (household.deleted_at != null) return null
  if (household.merged_into_household_id != null) return null
  if (String(household.status ?? '') !== 'lead') return null
  if (String(household.lead_source ?? '') !== 'manual_contact') return null
  if (String(row.lead_type ?? '') !== 'Manual Contact') return null
  if (row.deleted_at != null) return null

  const member = primaryMember(household.members)
  if (!member) return null
  const first = str(member.first_name) ?? ''
  const last = str(member.last_name) ?? ''
  const fullName = `${first} ${last}`.trim() || str(household.display_name) || 'Contact'
  const advisor = asSingle<Record<string, unknown>>(household.assigned_advisor)
  const category = isContactCategory(row.contact_category) ? row.contact_category : null
  const city = str(household.city) ?? str(member.city)
  const state = str(household.state) ?? str(member.state)
  const email = str(member.email) ?? str(household.primary_email)
  const phone = str(member.phone) ?? str(household.primary_phone)

  return {
    leadId,
    householdId: String(household.id),
    fullName,
    company: str(member.company),
    jobTitle: str(member.job_title),
    category,
    categoryLabel: contactCategoryLabel(category),
    email,
    phone: phone ? formatPhoneForDisplay(phone) : null,
    city,
    state,
    locationLabel: locationLabel(city, state),
    assignedAdvisorId: str(household.assigned_advisor_id),
    assignedAdvisorName: str(advisor?.display_name),
    howWeMet: str(row.how_we_met),
    dateEntered: str(row.submitted_at) ?? str(row.created_at) ?? str(household.created_at),
    followUpTaskSummary: str(row.follow_up_task_summary),
  }
}

export function mapContactDetail(
  row: Record<string, unknown>,
  extras?: {
    enteredByName?: string | null
    openTaskCount?: number
    noteCount?: number
    recentNotePreview?: string | null
    followUpTaskSummary?: string | null
  },
): ContactDetail | null {
  const base = mapContactListItem({
    ...row,
    follow_up_task_summary: extras?.followUpTaskSummary ?? row.follow_up_task_summary,
  })
  if (!base) return null
  const household = asSingle<Record<string, unknown>>(row.household)
  const member = primaryMember(household?.members)
  if (!member?.id) return null
  return {
    ...base,
    website: str(member.website),
    memberId: String(member.id),
    enteredByName: extras?.enteredByName ?? null,
    consent: mapConsentSummary(row.consent_snapshot),
    openTaskCount: extras?.openTaskCount ?? 0,
    noteCount: extras?.noteCount ?? 0,
    recentNotePreview: extras?.recentNotePreview ?? null,
  }
}

export function detailToFormValues(detail: ContactDetail): ContactFormValues {
  return {
    first_name: detail.fullName.split(' ')[0] ?? '',
    last_name: detail.fullName.split(' ').slice(1).join(' ') || '',
    email: detail.email ?? '',
    phone: detail.phone ?? '',
    company: detail.company ?? '',
    job_title: detail.jobTitle ?? '',
    website: detail.website ?? '',
    city: detail.city ?? '',
    state: detail.state ?? '',
    contact_category: detail.category ?? 'potential_client',
    how_we_met: detail.howWeMet ?? '',
    note: '',
    follow_up_task_title: '',
    follow_up_due_date: '',
    assigned_advisor_id: detail.assignedAdvisorId ?? '',
    consentEnabled: false,
    privacyAcknowledged: false,
    contactPermission: false,
    emailMarketingConsent: false,
    smsMarketingConsent: false,
    evidenceDescription: '',
  }
}

/** Prefer member first/last from raw detail when available. */
export function detailToFormValuesFromRow(
  detail: ContactDetail,
  firstName: string,
  lastName: string,
): ContactFormValues {
  return {
    ...detailToFormValues(detail),
    first_name: firstName,
    last_name: lastName,
    phone: detail.phone ?? '',
  }
}

export function mapDuplicateMatch(raw: unknown): DuplicateMatch | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const visibility = row.visibility === 'restricted' ? 'restricted' : 'accessible'
  const matchClass = str(row.match_class) ?? 'unknown'
  if (visibility === 'restricted') {
    return {
      visibility,
      matchClass,
      matchClassLabel: matchClassLabel(matchClass),
    }
  }
  return {
    visibility,
    matchClass,
    matchClassLabel: matchClassLabel(matchClass),
    householdId: str(row.household_id) ?? undefined,
    leadId: str(row.lead_id) ?? undefined,
    displayName: str(row.display_name) ?? undefined,
    householdStatus: str(row.household_status) ?? undefined,
    maskedEmail: str(row.masked_email) ?? undefined,
    maskedPhone: str(row.masked_phone) ?? undefined,
  }
}

export function parseDuplicatePreview(data: unknown): DuplicatePreviewResult | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (row.ok !== true) return null
  const operation = row.operation === 'update' ? 'update' : 'create'
  const matches = Array.isArray(row.matches)
    ? row.matches.map(mapDuplicateMatch).filter((m): m is DuplicateMatch => Boolean(m))
    : []
  const token = str(row.create_token)
  return {
    ok: true,
    operation,
    matches,
    hasRestrictedCollision: row.has_restricted_collision === true,
    createToken: token,
    expiresAt: str(row.expires_at),
  }
}

export function parseCreateResult(data: unknown): QuickAddCreateResult | CollisionCreateResult | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (row.ok === false && row.reason === 'collision') {
    const matches = Array.isArray(row.matches)
      ? row.matches.map(mapDuplicateMatch).filter((m): m is DuplicateMatch => Boolean(m))
      : []
    return {
      ok: false,
      reason: 'collision',
      matches,
      hasRestrictedCollision: row.has_restricted_collision === true,
    }
  }
  if (row.ok !== true) return null
  const leadId = str(row.lead_id)
  const householdId = str(row.household_id)
  const memberId = str(row.member_id)
  if (!leadId || !householdId || !memberId) return null
  return {
    ok: true,
    mode: row.mode === 'create_separate' ? 'create_separate' : 'create',
    leadId,
    householdId,
    memberId,
    noteId: str(row.note_id),
    taskId: str(row.task_id),
  }
}

export function parseUpdateResult(data: unknown): QuickAddUpdateResult | CollisionCreateResult | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (row.ok === false && row.reason === 'collision') {
    const matches = Array.isArray(row.matches)
      ? row.matches.map(mapDuplicateMatch).filter((m): m is DuplicateMatch => Boolean(m))
      : []
    return {
      ok: false,
      reason: 'collision',
      matches,
      hasRestrictedCollision: row.has_restricted_collision === true,
    }
  }
  if (row.ok !== true) return null
  const leadId = str(row.lead_id)
  const householdId = str(row.household_id)
  const memberId = str(row.member_id)
  if (!leadId || !householdId || !memberId) return null
  return {
    ok: true,
    mode: row.mode === 'update_separate' ? 'update_separate' : 'update',
    leadId,
    householdId,
    memberId,
  }
}

/** Strip sensitive keys from any object before logging/UI dump. */
export function assertNoSensitiveContactLeak(value: unknown): boolean {
  const text = JSON.stringify(value ?? {})
  if (!text) return true
  if (/create_token|token_hash|consent_snapshot|service_role/i.test(text) && /"create_token"\s*:/.test(text)) {
    // create_token in RPC responses is expected in memory parsers only; callers must not render it.
  }
  return !/"token_hash"\s*:/.test(text)
}
