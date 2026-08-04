/**
 * Browser adapter for the controlled public digital card read API.
 * Never imports server/admin modules. Never writes analytics or CRM records.
 */

import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'

export type FetchPublicCardLookup =
  | { key: string; slug?: never }
  | { slug: string; key?: never }

export type FetchPublicCardSuccess = {
  ok: true
  card: IdentitySurfacePublicDto
  httpStatus: number
}

export type FetchPublicCardFailure = {
  ok: false
  code: 'invalid_request' | 'unavailable' | 'network' | 'timeout' | 'server' | 'malformed_response'
  httpStatus: number | null
  /** User-safe copy only — never raw DB/stack errors. */
  message: string
}

export type FetchPublicCardResult = FetchPublicCardSuccess | FetchPublicCardFailure

export type FetchPublicCardOptions = {
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_ENDPOINT = '/api/digital-identity/card'
const DEFAULT_TIMEOUT_MS = 15_000

function userSafeMessage(code: FetchPublicCardFailure['code']): string {
  switch (code) {
    case 'invalid_request':
      return 'This card link is not valid.'
    case 'unavailable':
      return 'This advisor card is not published or is no longer available.'
    case 'timeout':
    case 'network':
      return 'We couldn’t load this card. Please check your connection and try again.'
    case 'server':
    case 'malformed_response':
    default:
      return 'We couldn’t load this card right now. Please try again in a moment.'
  }
}

function isPublicCardDto(value: unknown): value is IdentitySurfacePublicDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.publicKey === 'string' &&
    typeof record.slug === 'string' &&
    typeof record.displayName === 'string' &&
    record.primaryConnectLabel === "Let's Connect" &&
    Array.isArray(record.ctas)
  )
}

/**
 * Same-origin GET for a published advisor card by public key or slug.
 * Exactly one lookup identifier is required.
 */
export async function fetchPublicCard(
  lookup: FetchPublicCardLookup,
  options: FetchPublicCardOptions = {},
): Promise<FetchPublicCardResult> {
  const hasKey = typeof lookup.key === 'string'
  const hasSlug = typeof lookup.slug === 'string'
  if (hasKey === hasSlug) {
    return {
      ok: false,
      code: 'invalid_request',
      httpStatus: null,
      message: userSafeMessage('invalid_request'),
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const params = new URLSearchParams()
  if (hasKey) params.set('key', lookup.key!.trim())
  else params.set('slug', lookup.slug!.trim())

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetchImpl(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }

    if (response.status === 200) {
      const body = parsed as { ok?: unknown; card?: unknown } | null
      if (body?.ok === true && isPublicCardDto(body.card)) {
        return { ok: true, card: body.card, httpStatus: 200 }
      }
      return {
        ok: false,
        code: 'malformed_response',
        httpStatus: response.status,
        message: userSafeMessage('malformed_response'),
      }
    }

    if (response.status === 400) {
      return {
        ok: false,
        code: 'invalid_request',
        httpStatus: 400,
        message: userSafeMessage('invalid_request'),
      }
    }

    if (response.status === 404) {
      return {
        ok: false,
        code: 'unavailable',
        httpStatus: 404,
        message: userSafeMessage('unavailable'),
      }
    }

    return {
      ok: false,
      code: 'server',
      httpStatus: response.status,
      message: userSafeMessage('server'),
    }
  } catch (error) {
    const aborted =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    const code = aborted ? 'timeout' : 'network'
    return {
      ok: false,
      code,
      httpStatus: null,
      message: userSafeMessage(code),
    }
  } finally {
    clearTimeout(timeoutId)
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort)
    }
  }
}

/** Documented no-op contract for this phase. */
export function publicCardFetchSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  createsTask: false
  createsActivity: false
  createsCase: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    createsTask: false,
    createsActivity: false,
    createsCase: false,
  }
}
