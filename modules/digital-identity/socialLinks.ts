/**
 * CRM + public-card social link catalog for digital_cards.publish_profile.socialLinks.
 * No persistence, no admin client.
 */

import type { IdentitySocialLink } from './types.js'
import { normalizePublicHttpsUrl } from './urls.js'

export const PUBLIC_SOCIAL_NETWORKS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X / Twitter' },
] as const

export type PublicSocialNetworkKey = (typeof PUBLIC_SOCIAL_NETWORKS)[number]['key']

export type PublicSocialDrafts = Record<PublicSocialNetworkKey, string>

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function emptyPublicSocialDrafts(): PublicSocialDrafts {
  return {
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
    x: '',
  }
}

export function socialDraftsFromPublishProfile(raw: unknown): PublicSocialDrafts {
  const drafts = emptyPublicSocialDrafts()
  const links = asRecord(raw).socialLinks
  if (!Array.isArray(links)) return drafts

  for (const network of PUBLIC_SOCIAL_NETWORKS) {
    for (const item of links) {
      const record = asRecord(item)
      if (record.key !== network.key) continue
      const url = typeof record.url === 'string' ? record.url.trim() : ''
      if (url) {
        drafts[network.key] = url
        break
      }
    }
  }
  return drafts
}

export function buildConfiguredSocialLinks(
  drafts: PublicSocialDrafts,
): { ok: true; links: IdentitySocialLink[] } | { ok: false; message: string } {
  const links: IdentitySocialLink[] = []
  for (const network of PUBLIC_SOCIAL_NETWORKS) {
    const raw = typeof drafts[network.key] === 'string' ? drafts[network.key].trim() : ''
    if (!raw) continue
    const url = normalizePublicHttpsUrl(raw)
    if (!url) {
      return {
        ok: false,
        message: `${network.label} must be an https URL. javascript:, data:, http:, and other schemes are not allowed.`,
      }
    }
    links.push({ key: network.key, label: network.label, url })
  }
  return { ok: true, links }
}

/**
 * Replace only socialLinks. All other publish_profile keys stay as-is.
 * Never touches cta_config (separate column).
 */
export function mergePublishProfileSocialLinks(
  existing: unknown,
  socialLinks: readonly IdentitySocialLink[],
): Record<string, unknown> {
  return {
    ...asRecord(existing),
    socialLinks,
  }
}
