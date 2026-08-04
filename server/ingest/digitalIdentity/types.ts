/**
 * Public Digital Identity / Let's Connect → CRM ingest — shared types.
 * Mirrors supabase/migrations/026_digital_identity_connect_ingest.sql.
 * Public responses never include householdId, advisor ids, or task ids.
 */

export type MatchStatus = 'exact_trusted_match' | 'possible_match' | 'new_prospect'

export type MatchConfidence = 'high' | 'medium' | 'low'

/** Fully validated + typed public Let's Connect ingest request. */
export type DigitalIdentityConnectRequest = {
  submissionId: string
  cardPublicKey: string | null
  cardSlug: string | null
  campaignCode: string | null
  eventCode: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string | null
  title: string | null
  reasonForConnecting: string | null
  preferredFollowUpMethod: 'email' | 'phone' | 'either' | 'none' | null
  note: string | null
  consentSnapshot: {
    privacyAcknowledged: boolean
    contactPermission: boolean
    emailMarketingConsent: boolean
    smsMarketingConsent: boolean
    consentVersion: string | null
    consentedAt: string | null
  }
  formStartedAt: string | null
  formSubmittedAt: string | null
  sourcePage: string | null
  sourceChannel: 'link' | 'qr' | 'nfc' | 'share' | 'unknown' | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  referrer: string | null
}

/** Safe public Relationship Photo grant — never includes lead/household/document ids. */
export type RelationshipPhotoAvailability =
  | {
      available: true
      uploadToken: string
      expiresAt: string
    }
  | {
      available: false
    }

/** Safe public success — http-facing only. */
export type DigitalIdentityConnectSuccess = {
  ok: true
  created: boolean
  submissionId: string
  matchStatus: MatchStatus
  relationshipPhoto?: RelationshipPhotoAvailability
}

export type DigitalIdentityConnectError = {
  ok: false
  error: string
  code: string
}

export type DigitalIdentityConnectResult =
  | DigitalIdentityConnectSuccess
  | DigitalIdentityConnectError
