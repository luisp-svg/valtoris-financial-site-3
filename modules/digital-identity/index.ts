/**
 * Digital Identity & Relationship Platform — TypeScript contracts.
 *
 * Module key: digital_identity
 * v1 experience: advisor_card
 * Public CTA: Let's Connect
 *
 * Public card *lookup* lives under server/digitalIdentity (admin client).
 * This package stays free of service-role imports.
 */

export {
  DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS,
  DIGITAL_IDENTITY_CAPABILITIES,
  DIGITAL_IDENTITY_CONSENT_VERSION,
  DIGITAL_IDENTITY_CRM_ACTIVITY_EVENTS,
  DIGITAL_IDENTITY_LEAD_TYPE,
  DIGITAL_IDENTITY_MODULE_KEY,
  DIGITAL_IDENTITY_TASK_WORKFLOWS,
  LETS_CONNECT_CTA_LABEL,
  RESERVED_IDENTITY_SURFACE_KINDS,
  V1_IDENTITY_SURFACE_KIND,
} from './constants'

export {
  INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
  applyPhoneChangeToDigitalIdentityConsent,
  buildDigitalIdentityConsentSnapshot,
  emptyDigitalIdentityConsentSnapshot,
  hasRequiredDigitalIdentityConsent,
  normalizeDigitalIdentityConsentSnapshot,
  validateRequiredDigitalIdentityConsent,
} from './consent'
export type { DigitalIdentityConsentValidation } from './consent'

export { createDefaultAdvisorCardCtas, getEnabledPublicCtas } from './cta'

export {
  anonymousEventCreatesCrmRecord,
  emptyUtmAttribution,
  isIdentityAnonymousEventKey,
  normalizeUtmAttribution,
  sanitizeAnonymousSafeMetadata,
  validateAnonymousEventDraft,
} from './analytics'
export type { AnonymousEventValidation } from './analytics'

export {
  isPubliclyResolvableSurfaceStatus,
  pickPublishedAdvisorCardFields,
  toIdentitySurfacePublicDto,
} from './publicDto'

export {
  assemblePublishedCardDto,
  normalizePublicCtaItems,
  responseContainsInternalIds,
} from './assemblePublishedCard'
export type {
  AdvisorProfilePublicSource,
  DigitalCardPublicSource,
} from './assemblePublishedCard'

export { isValidIdentityPublicKey, isValidIdentitySlug, normalizeIdentitySlug } from './slug'

export { buildPublicCardPath, buildPublicCardSlugPath, normalizePublicHref } from './urls'

export {
  contactExchangeCreatesCase,
  rejectsTrustedAdvisorIds,
  validateDigitalIdentitySubmissionInput,
  viewOrDownloadCreatesHousehold,
} from './submission'
export type { SubmissionValidationResult } from './submission'

export { buildVCard, escapeVCardText, sanitizeVCardFilename } from './vcard'

export type {
  DigitalIdentityConsentSnapshot,
  DigitalIdentityConsentState,
  DigitalIdentityConsentVersion,
  DigitalIdentitySubmissionInput,
  IdentityAnonymousEvent,
  IdentityAnonymousEventKey,
  IdentityCampaign,
  IdentityCampaignStatus,
  IdentityCtaConfigItem,
  IdentityCtaConfiguration,
  IdentityCtaKey,
  IdentitySocialLink,
  IdentitySourceChannel,
  IdentitySurface,
  IdentitySurfaceKind,
  IdentitySurfaceKindReserved,
  IdentitySurfaceKindV1,
  IdentitySurfacePublicDto,
  IdentitySurfaceStatus,
  IdentityUtmAttribution,
  PreferredFollowUpMethod,
  PublishedAdvisorCard,
  VCardBuildInput,
  VCardBuildResult,
} from './types'
