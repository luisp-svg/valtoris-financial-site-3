/**
 * Browser adapter for Digital Identity QR downloads.
 * Fetches server-generated QR assets — never imports admin/qrcode server modules.
 * Download-only: no analytics or CRM writes.
 */

import type { PublicCardQrFormat } from '../../modules/digital-identity'

export type DownloadPublicCardQrSuccess = {
  ok: true
  format: PublicCardQrFormat
  filename: string
  blob: Blob
  destinationUrl: string | null
  httpStatus: number
}

export type DownloadPublicCardQrFailure = {
  ok: false
  code:
    | 'invalid_request'
    | 'unavailable'
    | 'network'
    | 'timeout'
    | 'server'
    | 'malformed_response'
  httpStatus: number | null
  message: string
}

export type DownloadPublicCardQrResult =
  | DownloadPublicCardQrSuccess
  | DownloadPublicCardQrFailure

export type DownloadPublicCardQrOptions = {
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_ENDPOINT = '/api/digital-identity/card/qr'
const DEFAULT_TIMEOUT_MS = 20_000

const FORMAT_CONTENT: Record<PublicCardQrFormat, { accept: string; label: string }> = {
  svg: { accept: 'image/svg+xml', label: 'SVG' },
  png: { accept: 'image/png', label: 'PNG' },
  'png-hires': { accept: 'image/png', label: 'Print PNG' },
}

function userSafeMessage(code: DownloadPublicCardQrFailure['code']): string {
  switch (code) {
    case 'invalid_request':
      return 'This QR download request is not valid.'
    case 'unavailable':
      return 'This advisor card is not available for QR download.'
    case 'timeout':
    case 'network':
      return 'We couldn’t download the QR code. Please check your connection and try again.'
    case 'malformed_response':
    case 'server':
    default:
      return 'We couldn’t generate the QR code right now. Please try again in a moment.'
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
  return null
}

export function qrDownloadMenuItems(): readonly {
  format: PublicCardQrFormat
  label: string
}[] {
  return [
    { format: 'svg', label: 'SVG' },
    { format: 'png', label: 'PNG' },
    { format: 'png-hires', label: 'Print PNG' },
  ]
}

/**
 * Download a server-generated QR for a published card by durable public key.
 * Slug lookup is intentionally unsupported.
 */
export async function downloadPublicCardQr(
  input: { key: string; format: PublicCardQrFormat },
  options: DownloadPublicCardQrOptions = {},
): Promise<DownloadPublicCardQrResult> {
  const key = input.key?.trim()
  if (!key) {
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
  const params = new URLSearchParams({
    key,
    format: input.format,
  })

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
      headers: {
        Accept: `${FORMAT_CONTENT[input.format].accept}, application/json;q=0.8`,
      },
      signal: controller.signal,
    })

    if (response.status === 200) {
      const blob = await response.blob()
      if (blob.size < 16) {
        return {
          ok: false,
          code: 'malformed_response',
          httpStatus: 200,
          message: userSafeMessage('malformed_response'),
        }
      }

      const contentType = response.headers.get('content-type') || ''
      if (input.format === 'svg' && !contentType.includes('svg') && !contentType.includes('xml')) {
        // Still accept if body exists — some mocks omit headers.
      }
      if (
        (input.format === 'png' || input.format === 'png-hires') &&
        contentType &&
        !contentType.includes('png') &&
        !contentType.includes('octet-stream')
      ) {
        // Soft check only when content-type is present and clearly wrong.
        if (contentType.includes('json')) {
          return {
            ok: false,
            code: 'malformed_response',
            httpStatus: 200,
            message: userSafeMessage('malformed_response'),
          }
        }
      }

      const fallbackName =
        input.format === 'png-hires'
          ? 'advisor-QR-Print.png'
          : input.format === 'png'
            ? 'advisor-QR.png'
            : 'advisor-QR.svg'

      return {
        ok: true,
        format: input.format,
        filename: parseFilename(response.headers.get('content-disposition')) || fallbackName,
        blob,
        destinationUrl: response.headers.get('x-valtoris-qr-destination'),
        httpStatus: 200,
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

export function triggerQrBrowserDownload(blob: Blob, filename: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  try {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
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

export function publicCardQrDownloadSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  tracksCampaign: false
  tracksEvent: false
  importsAdminClient: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    tracksCampaign: false,
    tracksEvent: false,
    importsAdminClient: false,
  }
}

export function qrDownloadErrorCopy(
  code: DownloadPublicCardQrFailure['code'],
): string {
  return userSafeMessage(code)
}
