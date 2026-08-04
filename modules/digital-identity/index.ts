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
  RELATIONSHIP_PHOTO_DOCUMENT_TYPE,
  RESERVED_IDENTITY_SURFACE_KINDS,
  V1_IDENTITY_SURFACE_KIND,
} from './constants.js'

export {
  INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
  applyPhoneChangeToDigitalIdentityConsent,
  buildDigitalIdentityConsentSnapshot,
  emptyDigitalIdentityConsentSnapshot,
  hasRequiredDigitalIdentityConsent,
  normalizeDigitalIdentityConsentSnapshot,
  validateRequiredDigitalIdentityConsent,
} from './consent.js'
export type { DigitalIdentityConsentValidation } from './consent.js'

export { createDefaultAdvisorCardCtas, getEnabledPublicCtas } from './cta.js'

export {
  anonymousEventCreatesCrmRecord,
  emptyUtmAttribution,
  isIdentityAnonymousEventKey,
  normalizeUtmAttribution,
  sanitizeAnonymousSafeMetadata,
  validateAnonymousEventDraft,
} from './analytics.js'
export type { AnonymousEventValidation } from './analytics.js'

export {
  isPubliclyResolvableSurfaceStatus,
  pickPublishedAdvisorCardFields,
  toIdentitySurfacePublicDto,
} from './publicDto.js'

export {
  assemblePublishedCardDto,
  normalizePublicCtaItems,
  responseContainsInternalIds,
} from './assemblePublishedCard.js'
export type {
  AdvisorProfilePublicSource,
  DigitalCardPublicSource,
} from './assemblePublishedCard.js'

export { isValidIdentityPublicKey, isValidIdentitySlug, normalizeIdentitySlug } from './slug.js'

export { buildPublicCardPath, buildPublicCardSlugPath, normalizePublicHref } from './urls.js'

export {
  contactExchangeCreatesCase,
  rejectsTrustedAdvisorIds,
  validateDigitalIdentitySubmissionInput,
  viewOrDownloadCreatesHousehold,
} from './submission.js'
export type { SubmissionValidationResult } from './submission.js'

export {
  buildAbsolutePublicCardUrl,
  buildVCard,
  buildVCardFromPublicDto,
  buildVCardNote,
  escapeVCardText,
  sanitizeVCardFilename,
  vCardGenerationSideEffects,
} from './vcard.js'

export {
  buildCampaignAttributionSearchParams,
  buildCampaignLink,
  buildCampaignQrDestinationPath,
  buildCampaignQrDestinationUrl,
  buildDefaultCardLink,
  buildEventLink,
  buildPublicCardPathWithAttribution,
  buildShareLink,
  extractReferrerHost,
  normalizeCampaignAttributionQuery,
  parseCampaignAttributionFromSearch,
} from './campaignUrls.js'
export type {
  CampaignAttributionQuery,
  NormalizedCampaignAttribution,
} from './campaignUrls.js'

export {
  PUBLIC_CARD_QR_FORMATS,
  buildQrDestinationPath,
  buildQrDestinationUrl,
  buildQrPdfPlaceholder,
  getQrRenderSpec,
  isKeyBasedQrDestination,
  parsePublicCardQrFormat,
  qrGenerationSideEffects,
  sanitizeQrFilename,
} from './qr.js'
export type {
  PublicCardQrFormat,
  PublicCardQrFormatFuture,
  PublicCardQrRenderSpec,
} from './qr.js'

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
} from './types.js'
