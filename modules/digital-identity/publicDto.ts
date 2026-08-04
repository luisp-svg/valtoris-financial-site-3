/**
 * Public DTO builders — allowlisted fields only; no internal IDs.
 */

import { LETS_CONNECT_CTA_LABEL, V1_IDENTITY_SURFACE_KIND } from './constants.js'
import { getEnabledPublicCtas } from './cta.js'
import type {
  IdentitySurface,
  IdentitySurfacePublicDto,
  IdentitySurfaceStatus,
  PublishedAdvisorCard,
} from './types.js'

const INTERNAL_ID_KEYS = [
  'id',
  'advisorProfileId',
  'advisorId',
  'advisor_profile_id',
  'userId',
  'user_id',
  'householdId',
] as const

export function isPubliclyResolvableSurfaceStatus(status: IdentitySurfaceStatus): boolean {
  return status === 'published'
}

/**
 * Builds a visitor-safe DTO. Returns null for draft/disabled/non-v1 kinds.
 * Never copies internal advisor/profile UUIDs onto the DTO.
 */
export function toIdentitySurfacePublicDto(input: {
  surface: IdentitySurface
  /** Absolute or site-relative public card URL for this surface. */
  cardUrl: string
}): IdentitySurfacePublicDto | null {
  const { surface, cardUrl } = input

  if (!isPubliclyResolvableSurfaceStatus(surface.status)) return null
  if (surface.kind !== V1_IDENTITY_SURFACE_KIND) return null
  if (surface.deletedAt) return null

  const profile = surface.publishProfile
  const ctas = getEnabledPublicCtas(surface.ctaConfig)

  const dto: IdentitySurfacePublicDto = {
    publicKey: surface.publicKey,
    slug: surface.slug,
    kind: V1_IDENTITY_SURFACE_KIND,
    displayName: profile.displayName,
    approvedTitle: profile.approvedTitle,
    approvedCompany: profile.approvedCompany,
    headline: profile.headline,
    bio: profile.bio,
    headshotUrl: profile.headshotUrl,
    phone: profile.phoneVisible ? profile.phone : null,
    email: profile.emailVisible ? profile.email : null,
    website: profile.website,
    socialLinks: profile.socialLinks,
    specialties: profile.specialties,
    calendlyUrl: profile.calendlyUrl,
    themeKey: profile.themeKey || surface.themeKey,
    ctas,
    primaryConnectLabel: LETS_CONNECT_CTA_LABEL,
    cardUrl,
  }

  assertNoInternalIds(dto)
  return dto
}

/** Test/helper: ensure a published profile object does not smuggle private keys. */
export function pickPublishedAdvisorCardFields(
  profile: PublishedAdvisorCard,
): PublishedAdvisorCard {
  return {
    displayName: profile.displayName,
    approvedTitle: profile.approvedTitle,
    approvedCompany: profile.approvedCompany,
    headline: profile.headline,
    bio: profile.bio,
    headshotUrl: profile.headshotUrl,
    phoneVisible: profile.phoneVisible,
    phone: profile.phone,
    emailVisible: profile.emailVisible,
    email: profile.email,
    website: profile.website,
    socialLinks: profile.socialLinks,
    specialties: profile.specialties,
    calendlyUrl: profile.calendlyUrl,
    themeKey: profile.themeKey,
  }
}

function assertNoInternalIds(dto: IdentitySurfacePublicDto): void {
  const record = dto as unknown as Record<string, unknown>
  for (const key of INTERNAL_ID_KEYS) {
    if (key in record && record[key] !== undefined) {
      throw new Error(`public DTO must not include internal field: ${key}`)
    }
  }
}
