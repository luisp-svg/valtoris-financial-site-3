/**
 * Digital Identity module constants — Sprint 5.2 foundation.
 * Declarations only; no runtime auth, routes, or persistence.
 */

/** Module Registry key. */
export const DIGITAL_IDENTITY_MODULE_KEY = 'digital_identity' as const

/** Versioned consent contract for Let’s Connect submissions. */
export const DIGITAL_IDENTITY_CONSENT_VERSION = 'digital-identity-consent-v1' as const

/**
 * Primary public CTA label (exact product copy).
 * Internal names may still say relationship capture / contact exchange.
 */
export const LETS_CONNECT_CTA_LABEL = "Let's Connect" as const

/** v1 surface kind — only advisor cards are enabled at runtime. */
export const V1_IDENTITY_SURFACE_KIND = 'advisor_card' as const

/** Reserved for future surfaces — not enabled at runtime. */
export const RESERVED_IDENTITY_SURFACE_KINDS = [
  'team_card',
  'company_card',
  'public_profile',
  'referral_portal',
  'partner_portal',
] as const

/** CRM lead_type label for Let’s Connect submissions (future ingest). */
export const DIGITAL_IDENTITY_LEAD_TYPE = 'Digital Identity' as const

/** Task workflow types declared on the module (not automated yet). */
export const DIGITAL_IDENTITY_TASK_WORKFLOWS = [
  'review_digital_identity_lead',
  'resolve_digital_identity_duplicate',
] as const

/** CRM Activity Engine event keys declared on the module (not wired yet). */
export const DIGITAL_IDENTITY_CRM_ACTIVITY_EVENTS = [
  'digital_identity.lead_created',
  'digital_identity.lead_matched',
  'digital_identity.lead_possible_match',
  'digital_identity.contact_shared',
  'digital_identity.duplicate_resolved',
  'digital_identity.relationship_photo_added',
  'digital_identity.relationship_photo_removed',
  'digital_identity.relationship_photo_replaced',
] as const

/** Document Engine type key for optional Let's Connect relationship photos. */
export const RELATIONSHIP_PHOTO_DOCUMENT_TYPE = 'relationship_photo' as const

/** Anonymous analytics event keys (never household Activities). */
export const DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS = [
  'digital_identity.viewed',
  'digital_identity.contact_downloaded',
  'digital_identity.form_started',
  'digital_identity.form_submitted',
  'digital_identity.appointment_clicked',
  'digital_identity.diagnostic_clicked',
  'digital_identity.link_clicked',
  'digital_identity.share_clicked',
  'digital_identity.qr_scanned',
  'digital_identity.nfc_opened',
] as const

/** Capability keys declared for a future Permission Engine (not enforced). */
export const DIGITAL_IDENTITY_CAPABILITIES = [
  'digital_identity.read_own',
  'digital_identity.write_own',
  'digital_identity.publish_own',
  'digital_identity.admin',
  'digital_identity.campaigns.manage_own',
  'digital_identity.campaigns.admin',
  'digital_identity.analytics.read_own',
  'digital_identity.analytics.read_all',
  'digital_identity.lead.read',
] as const
