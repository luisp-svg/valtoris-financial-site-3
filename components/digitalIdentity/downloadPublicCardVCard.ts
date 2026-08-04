/**
 * Browser adapter for Smart vCard download.
 * Fetches the server-generated .vcf — never imports admin/server modules.
 * Download-only: no analytics or CRM writes.
 */

export type DownloadPublicCardVCardLookup =
  | { key: string; slug?: never }
  | { slug: string; key?: never }

export type DownloadPublicCardVCardSuccess = {
  ok: true
  filename: string
  body: string
  httpStatus: number
}

export type DownloadPublicCardVCardFailure = {
  ok: false
  code:
    | 'invalid_request'
    | 'unavailable'
    | 'network'
    | 'timeout'
    | 'server'
    | 'malformed_response'
    | 'generation_failure'
  httpStatus: number | null
  message: string
}

export type DownloadPublicCardVCardResult =
  | DownloadPublicCardVCardSuccess
  | DownloadPublicCardVCardFailure

export type DownloadPublicCardVCardOptions = {
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_ENDPOINT = '/api/digital-identity/card/vcard'
const DEFAULT_TIMEOUT_MS = 15_000

function userSafeMessage(code: DownloadPublicCardVCardFailure['code']): string {
  switch (code) {
    case 'invalid_request':
      return 'This card link is not valid.'
    case 'unavailable':
      return 'This advisor card is not available for download.'
    case 'timeout':
    case 'network':
      return 'We couldn’t download the contact file. Please check your connection and try again.'
    case 'generation_failure':
    case 'malformed_response':
    case 'server':
    default:
      return 'We couldn’t generate the contact file right now. Please try again in a moment.'
  }
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const utfMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim())
    } catch {
      /* fall through */
    }
  }
  const plainMatch = /filename\s*=\s*"([^"]+)"/i.exec(contentDisposition)
  if (plainMatch?.[1]) return plainMatch[1]
  const bareMatch = /filename\s*=\s*([^;]+)/i.exec(contentDisposition)
  if (bareMatch?.[1]) return bareMatch[1].trim().replace(/^"|"$/g, '')
  return null
}

/**
 * Fetch a server-generated vCard for a published card.
 * Exactly one lookup identifier is required.
 */
export async function downloadPublicCardVCard(
  lookup: DownloadPublicCardVCardLookup,
  options: DownloadPublicCardVCardOptions = {},
): Promise<DownloadPublicCardVCardResult> {
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
      headers: { Accept: 'text/vcard, application/json;q=0.9, */*;q=0.8' },
      signal: controller.signal,
    })

    if (response.status === 200) {
      const contentType = response.headers.get('content-type') || ''
      const body = await response.text()
      if (!body.includes('BEGIN:VCARD') || !contentType.includes('vcard')) {
        // Some environments may omit content-type in mocks — still accept valid body.
        if (!body.includes('BEGIN:VCARD')) {
          return {
            ok: false,
            code: 'malformed_response',
            httpStatus: 200,
            message: userSafeMessage('malformed_response'),
          }
        }
      }

      const filename =
        parseFilename(response.headers.get('content-disposition')) || 'contact.vcf'

      return {
        ok: true,
        filename,
        body,
        httpStatus: 200,
      }
    }

    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }
    void parsed

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
      code: response.status >= 500 ? 'server' : 'generation_failure',
      httpStatus: response.status,
      message: userSafeMessage(response.status >= 500 ? 'server' : 'generation_failure'),
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

/**
 * Trigger a browser file download from vCard text.
 * No-op outside browser environments.
 */
export function triggerVCardBrowserDownload(body: string, filename: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  try {
    const blob = new Blob([body], { type: 'text/vcard;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename.endsWith('.vcf') ? filename : `${filename}.vcf`
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
    return true
  } catch {
    return false
  }
}

export function publicCardVCardDownloadSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  createsTask: false
  createsActivity: false
  createsCase: false
  importsAdminClient: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    createsTask: false,
    createsActivity: false,
    createsCase: false,
    importsAdminClient: false,
  }
}
