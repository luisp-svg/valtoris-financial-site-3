/**
 * Digital Identity domain contracts — Sprint 5.2 TypeScript foundation.
 * No persistence, routes, UI, or ingest in this phase.
 */

/** v1 runtime kind. */
export type IdentitySurfaceKindV1 = 'advisor_card'

/** Reserved kinds — typed for forward compatibility; not enabled at runtime. */
export type IdentitySurfaceKindReserved =
  | 'team_card'
  | 'company_card'
  | 'public_profile'
  | 'referral_portal'
  | 'partner_portal'

/**
 * All known surface kinds.
 * Runtime enablement is gated separately — only `advisor_card` in v1.
 */
export type IdentitySurfaceKind = IdentitySurfaceKindV1 | IdentitySurfaceKindReserved

export type IdentitySurfaceStatus = 'draft' | 'published' | 'disabled'

export type IdentitySourceChannel = 'link' | 'qr' | 'nfc' | 'share' | 'unknown'

export type IdentityCampaignStatus = 'active' | 'disabled'

export type PreferredFollowUpMethod = 'email' | 'phone' | 'either' | 'none'

export type IdentitySocialLink = {
  key: string
  label: string
  url: string
}

export type IdentityCtaKey =
  | 'lets_connect'
  | 'save_contact'
  | 'book_appointment'
  | 'family_report_card'
  | 'business_report_card'
  | 'protection_gap'
  | 'credit_assessment'

export type IdentityCtaConfigItem = {
  key: IdentityCtaKey
  /** Exact public label when shown. */
  label: string
  enabled: boolean
  /** Optional deep-link or action hint (never a trusted advisor UUID). */
  href?: string | null
}

export type IdentityCtaConfiguration = {
  /** Must be exactly "Let's Connect" for the primary capture CTA. */
  primaryConnectLabel: "Let's Connect"
  items: readonly IdentityCtaConfigItem[]
}

/**
 * Canonical identity surface (persistence shape for future migration).
 * Advisor identity remains on `advisor_profiles` — this is publish + addressing.
 */
export type IdentitySurface = {
  id: string
  /** Opaque durable public key for QR/NFC (immutable once issued). */
  publicKey: string
  /** Human-readable slug; may change without breaking printed QR targets. */
  slug: string
  kind: IdentitySurfaceKind
  status: IdentitySurfaceStatus
  /** Soft link to advisor_profiles.id — server-trusted only. */
  advisorProfileId: string
  themeKey: string
  publishProfile: PublishedAdvisorCard
  ctaConfig: IdentityCtaConfiguration
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  disabledAt: string | null
  deletedAt: string | null
}

/**
 * Approved publish fields for an advisor card.
 * Sourced from advisor_profiles + approved overrides — not a second profile table.
 */
export type PublishedAdvisorCard = {
  displayName: string
  approvedTitle: string | null
  approvedCompany: string | null
  headline: string | null
  bio: string | null
  headshotUrl: string | null
  phoneVisible: boolean
  phone: string | null
  emailVisible: boolean
  email: string | null
  website: string | null
  socialLinks: readonly IdentitySocialLink[]
  specialties: readonly string[]
  calendlyUrl: string | null
  themeKey: string
}

/**
 * Safe public DTO — no internal advisor/profile/user UUIDs.
 * Returned to anonymous visitors via controlled API/RPC (future).
 */
export type IdentitySurfacePublicDto = {
  publicKey: string
  slug: string
  kind: IdentitySurfaceKindV1
  displayName: string
  approvedTitle: string | null
  approvedCompany: string | null
  headline: string | null
  bio: string | null
  headshotUrl: string | null
  phone: string | null
  email: string | null
  website: string | null
  socialLinks: readonly IdentitySocialLink[]
  specialties: readonly string[]
  calendlyUrl: string | null
  themeKey: string
  ctas: readonly IdentityCtaConfigItem[]
  primaryConnectLabel: "Let's Connect"
  cardUrl: string
}

export type IdentityCampaign = {
  id: string
  /** Soft FK to surface (digital_cards.id in proposed migration). */
  surfaceId: string
  surfacePublicKey: string
  campaignCode: string
  eventCode: string | null
  label: string
  status: IdentityCampaignStatus
  defaultUtms: IdentityUtmAttribution
  sourceChannelDefault: IdentitySourceChannel
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type IdentityUtmAttribution = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
}

export type IdentityAnonymousEventKey =
  | 'digital_identity.viewed'
  | 'digital_identity.contact_downloaded'
  | 'digital_identity.form_started'
  | 'digital_identity.form_submitted'
  | 'digital_identity.appointment_clicked'
  | 'digital_identity.diagnostic_clicked'
  | 'digital_identity.link_clicked'
  | 'digital_identity.share_clicked'
  | 'digital_identity.qr_scanned'
  | 'digital_identity.nfc_opened'

/**
 * Anonymous analytics event — never includes household, lead, or contact PII.
 */
export type IdentityAnonymousEvent = {
  eventKey: IdentityAnonymousEventKey
  anonymousSessionId: string
  surfacePublicKey: string
  campaignCode: string | null
  eventCode: string | null
  sourceChannel: IdentitySourceChannel
  utm: IdentityUtmAttribution
  occurredAt: string
  /** Allowlisted non-PII metadata only (e.g. diagnostic type, link key). */
  safeMetadata: Readonly<Record<string, string | number | boolean | null>>
}

export type DigitalIdentityConsentVersion = 'digital-identity-consent-v1'

export type DigitalIdentityConsentState = {
  privacyAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
}

export type DigitalIdentityConsentSnapshot = DigitalIdentityConsentState & {
  consentVersion: DigitalIdentityConsentVersion | null
  consentedAt: string | null
}

/**
 * Untrusted browser payload for Let’s Connect (future ingest).
 * Must NOT include trusted advisor UUIDs.
 */
export type DigitalIdentitySubmissionInput = {
  submissionId: string
  /** Prefer publicKey; slug accepted then resolved server-side. */
  cardPublicKey?: string
  cardSlug?: string
  campaignCode?: string | null
  eventCode?: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  company?: string | null
  title?: string | null
  reasonForConnecting?: string | null
  preferredFollowUpMethod?: PreferredFollowUpMethod | null
  note?: string | null
  consent: DigitalIdentityConsentState
  /** Client timing for abuse checks (min fill). */
  formStartedAt?: string | null
  formSubmittedAt?: string | null
  /** Honeypot — must be empty. */
  website?: string
  companyUrl?: string
  /** Allowlisted UTM / channel hints (untrusted). */
  sourceChannel?: IdentitySourceChannel | null
  utm?: Partial<IdentityUtmAttribution> | null
}

export type VCardBuildInput = {
  displayName: string
  firstName?: string | null
  lastName?: string | null
  organization?: string | null
  title?: string | null
  phone?: string | null
  email?: string | null
  /** Primary URL (typically the public card URL). */
  url?: string | null
  /** Extra https URLs (website, Calendly, social) — never hidden private fields. */
  additionalUrls?: readonly string[] | null
  note?: string | null
  photoUrl?: string | null
}

export type VCardBuildResult = {
  /** vCard 3.0 document body (CRLF). */
  body: string
  /** Sanitized download filename ending in .vcf */
  filename: string
  /** Always false — vCard never creates CRM records. */
  createsCrmRecord: false
}
