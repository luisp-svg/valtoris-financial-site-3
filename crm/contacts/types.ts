/** Quick Add Contact / Contacts UI domain types (Phase Q1B). */

export const CONTACT_CATEGORIES = [
  'potential_client',
  'referral_partner',
  'professional_partner',
  'vendor',
  'other',
] as const

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export type ContactListItem = {
  leadId: string
  householdId: string
  fullName: string
  company: string | null
  jobTitle: string | null
  category: ContactCategory | null
  categoryLabel: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  locationLabel: string | null
  assignedAdvisorId: string | null
  assignedAdvisorName: string | null
  howWeMet: string | null
  dateEntered: string | null
  followUpTaskSummary: string | null
}

export type ContactConsentSummary = {
  privacyAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
  consentVersion: string | null
  consentedAt: string | null
  evidenceDescription: string | null
  hasConsent: boolean
  summaryLabel: string
}

export type ContactDetail = ContactListItem & {
  website: string | null
  memberId: string
  enteredByName: string | null
  consent: ContactConsentSummary
  openTaskCount: number
  noteCount: number
  recentNotePreview: string | null
}

export type ContactFormValues = {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  job_title: string
  website: string
  city: string
  state: string
  contact_category: ContactCategory | ''
  how_we_met: string
  note: string
  follow_up_task_title: string
  follow_up_due_date: string
  assigned_advisor_id: string
  /** Explicit consent UI — never send consentedAt from the browser. */
  consentEnabled: boolean
  privacyAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
  evidenceDescription: string
}

export type ContactFormField =
  | keyof ContactFormValues
  | 'form'
  | 'consent'

export type ContactListFilters = {
  search: string
  category: ContactCategory | 'all'
  assignedAdvisorId: string | 'all'
  page: number
  pageSize: number
}

export type ContactListResult = {
  /** Current page slice after client-side filter/pagination. */
  items: ContactListItem[]
  /** Total matching contacts after client filters (not the server page size). */
  total: number
  page: number
  pageSize: number
  /** Rows returned from the capped RLS fetch before client filters. */
  fetchedCount: number
  /**
   * True when the RLS fetch hit CONTACTS_FETCH_CAP.
   * Client pagination must not be described as server pagination.
   */
  fetchCapped: boolean
}

export type DuplicateMatchVisibility = 'accessible' | 'restricted'

export type DuplicateMatch = {
  visibility: DuplicateMatchVisibility
  matchClass: string
  matchClassLabel: string
  householdId?: string
  leadId?: string
  displayName?: string
  householdStatus?: string
  maskedEmail?: string
  maskedPhone?: string
}

export type DuplicatePreviewResult = {
  ok: true
  operation: 'create' | 'update'
  matches: DuplicateMatch[]
  hasRestrictedCollision: boolean
  /** Opaque one-time token — UI memory only. */
  createToken: string | null
  expiresAt: string | null
}

export type QuickAddCreateResult = {
  ok: true
  mode: 'create' | 'create_separate'
  leadId: string
  householdId: string
  memberId: string
  noteId: string | null
  taskId: string | null
}

export type QuickAddUpdateResult = {
  ok: true
  mode: 'update' | 'update_separate'
  leadId: string
  householdId: string
  memberId: string
}

export type CollisionCreateResult = {
  ok: false
  reason: 'collision'
  matches: DuplicateMatch[]
  hasRestrictedCollision: boolean
}

export type AdvisorOption = {
  id: string
  displayName: string
}

export type SafeContactError = {
  code: string
  message: string
  field?: ContactFormField
}
