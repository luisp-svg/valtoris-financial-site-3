/**
 * Browser adapter for the Let's Connect CRM ingest API.
 * Never imports server/admin modules.
 */

export type LetsConnectSubmitSuccess = {
  ok: true
  created: boolean
  submissionId: string
  matchStatus: string | null
  httpStatus: number
}

export type LetsConnectSubmitFailure = {
  ok: false
  error: string
  code:
    | 'validation'
    | 'rate_limited'
    | 'payload_too_large'
    | 'network'
    | 'timeout'
    | 'server'
    | 'malformed_response'
  httpStatus: number | null
}

export type LetsConnectSubmitResult = LetsConnectSubmitSuccess | LetsConnectSubmitFailure

export type SubmitLetsConnectOptions = {
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_ENDPOINT = '/api/digital-identity/connect'
const DEFAULT_TIMEOUT_MS = 25_000

function userSafeMessage(code: LetsConnectSubmitFailure['code'], apiError?: string): string {
  switch (code) {
    case 'validation':
      return apiError?.trim() || 'Please review your details and try again.'
    case 'rate_limited':
      return 'Too many submission attempts were received. Please wait a moment and try again.'
    case 'payload_too_large':
      return 'Your submission is too large to send. Please refresh and try again.'
    case 'timeout':
    case 'network':
      return 'We couldn’t save your connection yet. Your details are still here. Please try again.'
    case 'server':
    case 'malformed_response':
    default:
      return 'We couldn’t save your connection yet. Your details are still here. Please try again.'
  }
}

function classifyHttpStatus(status: number): LetsConnectSubmitFailure['code'] {
  if (status === 429) return 'rate_limited'
  if (status === 413) return 'payload_too_large'
  if (status >= 400 && status < 500) return 'validation'
  return 'server'
}

/**
 * POST a Let's Connect payload to the CRM ingest API.
 * Never imports admin clients. Never writes analytics or CRM records from the browser.
 */
export async function submitLetsConnect(
  body: Record<string, unknown>,
  options: SubmitLetsConnectOptions = {},
): Promise<LetsConnectSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }

    if (!response.ok) {
      const code = classifyHttpStatus(response.status)
      const apiError =
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as { error?: unknown }).error === 'string'
          ? String((parsed as { error: string }).error)
          : undefined
      return {
        ok: false,
        error: userSafeMessage(code, code === 'validation' ? apiError : undefined),
        code,
        httpStatus: response.status,
      }
    }

    if (!parsed || typeof parsed !== 'object' || (parsed as { ok?: unknown }).ok !== true) {
      return {
        ok: false,
        error: userSafeMessage('malformed_response'),
        code: 'malformed_response',
        httpStatus: response.status,
      }
    }

    const record = parsed as Record<string, unknown>
    const bodySubmissionId =
      typeof body.submissionId === 'string' ? body.submissionId : ''

    return {
      ok: true,
      created: record.created === true,
      submissionId:
        typeof record.submissionId === 'string' ? record.submissionId : bodySubmissionId,
      matchStatus: typeof record.matchStatus === 'string' ? record.matchStatus : null,
      httpStatus: response.status,
    }
  } catch (error) {
    const isAbort =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    if (isAbort) {
      return {
        ok: false,
        error: userSafeMessage('timeout'),
        code: 'timeout',
        httpStatus: null,
      }
    }
    return {
      ok: false,
      error: userSafeMessage('network'),
      code: 'network',
      httpStatus: null,
    }
  } finally {
    clearTimeout(timeoutId)
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort)
    }
  }
}
