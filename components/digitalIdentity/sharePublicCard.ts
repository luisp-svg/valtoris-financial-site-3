/**
 * Browser-only Share for the public Digital Identity card.
 * Canonical target is always /c/k/{publicKey}. Never slug, never CRM ids.
 * No analytics, no CRM writes, no admin client.
 */

import { buildAbsolutePublicCardUrl, buildPublicCardPath, isValidIdentityPublicKey } from '../../modules/digital-identity'

export const PUBLIC_CARD_SHARE_COPIED_MESSAGE = 'Link copied' as const

export type PublicCardShareMethod = 'web_share' | 'clipboard'

export type PublicCardShareSuccess =
  | { ok: true; method: 'web_share'; url: string; message: null }
  | { ok: true; method: 'clipboard'; url: string; message: typeof PUBLIC_CARD_SHARE_COPIED_MESSAGE }

export type PublicCardShareCancelled = {
  ok: true
  method: 'cancelled'
  url: string
  message: null
}

export type PublicCardShareFailure = {
  ok: false
  code: 'invalid_public_key' | 'invalid_origin' | 'share_unavailable'
  message: string
}

export type PublicCardShareResult =
  | PublicCardShareSuccess
  | PublicCardShareCancelled
  | PublicCardShareFailure

export type SharePublicCardInput = {
  publicKey: string
  displayName: string
  origin: string
}

export type SharePublicCardDeps = {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data?: ShareData) => boolean
  writeClipboard?: (text: string) => Promise<void>
}

export function publicCardShareSideEffects(): {
  writesAnalytics: false
  writesDigitalCardEvents: false
  createsLead: false
  createsHousehold: false
  createsActivity: false
  createsTask: false
  createsCase: false
  rotatesPublicKey: false
  usesSlugAsCanonical: false
  importsAdminClient: false
  usesServiceRole: false
} {
  return {
    writesAnalytics: false,
    writesDigitalCardEvents: false,
    createsLead: false,
    createsHousehold: false,
    createsActivity: false,
    createsTask: false,
    createsCase: false,
    rotatesPublicKey: false,
    usesSlugAsCanonical: false,
    importsAdminClient: false,
    usesServiceRole: false,
  }
}

/** Durable path only — never `/c/{slug}`. */
export function buildCanonicalSharePath(publicKey: string): string | null {
  const trimmed = typeof publicKey === 'string' ? publicKey.trim() : ''
  if (!isValidIdentityPublicKey(trimmed)) return null
  const path = buildPublicCardPath(trimmed)
  if (!path.startsWith('/c/k/')) return null
  if (path.includes('/c/') && !path.startsWith('/c/k/')) return null
  return path
}

/** Absolute canonical URL for Web Share / clipboard. */
export function buildCanonicalShareUrl(origin: string, publicKey: string): string | null {
  const path = buildCanonicalSharePath(publicKey)
  if (!path) return null
  const absolute = buildAbsolutePublicCardUrl(origin, path)
  if (!absolute) return null
  if (!isCanonicalShareUrl(absolute)) return null
  return absolute
}

export function isCanonicalShareUrl(urlOrPath: string): boolean {
  try {
    const pathOnly = urlOrPath.startsWith('/')
      ? (urlOrPath.split(/[?#]/)[0] || '')
      : new URL(urlOrPath).pathname
    return /^\/c\/k\/[^/]+$/.test(pathOnly)
  } catch {
    return false
  }
}

export function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  return name === 'AbortError'
}

export function sharePublicCardErrorCopy(
  code: PublicCardShareFailure['code'],
): string {
  switch (code) {
    case 'invalid_public_key':
    case 'invalid_origin':
      return 'This card link is not valid.'
    default:
      return 'We couldn’t share this card. Please try again.'
  }
}

function defaultShare(data: ShareData): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return Promise.reject(new Error('share_unavailable'))
  }
  return navigator.share(data)
}

function defaultCanShare(data?: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false
  }
  if (typeof navigator.canShare === 'function' && data) {
    try {
      return navigator.canShare(data)
    } catch {
      return true
    }
  }
  return true
}

function defaultWriteClipboard(text: string): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    return Promise.reject(new Error('clipboard_unavailable'))
  }
  return navigator.clipboard.writeText(text)
}

function buildShareData(displayName: string, url: string): ShareData {
  const title = displayName.trim() || 'Valtoris Financial'
  return {
    title,
    text: `${title} · Financial Strategist`,
    url,
  }
}

/**
 * Share the permanent Digital Identity URL.
 * Web Share when available; clipboard fallback otherwise.
 * User cancellation is success with method "cancelled" — never an app error.
 */
export async function sharePublicCard(
  input: SharePublicCardInput,
  deps: SharePublicCardDeps = {},
): Promise<PublicCardShareResult> {
  const publicKey = typeof input.publicKey === 'string' ? input.publicKey.trim() : ''
  if (!isValidIdentityPublicKey(publicKey)) {
    return {
      ok: false,
      code: 'invalid_public_key',
      message: sharePublicCardErrorCopy('invalid_public_key'),
    }
  }

  const url = buildCanonicalShareUrl(input.origin, publicKey)
  if (!url) {
    return {
      ok: false,
      code: 'invalid_origin',
      message: sharePublicCardErrorCopy('invalid_origin'),
    }
  }

  const data = buildShareData(input.displayName, url)
  const share = deps.share ?? defaultShare
  const canShare = deps.canShare ?? defaultCanShare
  const writeClipboard = deps.writeClipboard ?? defaultWriteClipboard

  if (canShare(data)) {
    try {
      await share(data)
      if (!isCanonicalShareUrl(data.url ?? '')) {
        return {
          ok: false,
          code: 'invalid_origin',
          message: sharePublicCardErrorCopy('invalid_origin'),
        }
      }
      return { ok: true, method: 'web_share', url, message: null }
    } catch (error) {
      if (isShareCancellation(error)) {
        return { ok: true, method: 'cancelled', url, message: null }
      }
      // Fall through to clipboard — not treated as an application error yet.
    }
  }

  try {
    await writeClipboard(url)
    return {
      ok: true,
      method: 'clipboard',
      url,
      message: PUBLIC_CARD_SHARE_COPIED_MESSAGE,
    }
  } catch (error) {
    if (isShareCancellation(error)) {
      return { ok: true, method: 'cancelled', url, message: null }
    }
    return {
      ok: false,
      code: 'share_unavailable',
      message: sharePublicCardErrorCopy('share_unavailable'),
    }
  }
}
