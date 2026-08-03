import type { FamilyReportCardClientIngestBody } from './buildFamilyIngestPayload'

export type FamilyCrmSubmitSuccess = {
  ok: true
  created: boolean
  submissionId: string
  assessmentId: string | null
  matchStatus: string | null
  sheetsSyncStatus: string | null
  httpStatus: number
}

export type FamilyCrmSubmitFailure = {
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

export type FamilyCrmSubmitResult = FamilyCrmSubmitSuccess | FamilyCrmSubmitFailure

export type SubmitFamilyReportCardToCrmOptions = {
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_ENDPOINT = '/api/ingest-family-report-card'
const DEFAULT_TIMEOUT_MS = 25_000

function userSafeMessage(code: FamilyCrmSubmitFailure['code'], apiError?: string): string {
  switch (code) {
    case 'validation':
      return apiError?.trim() || 'Please review your answers and try again.'
    case 'rate_limited':
      return 'Too many submission attempts were received. Please wait a moment and try again.'
    case 'payload_too_large':
      return 'Your submission is too large to send. Please refresh and try again.'
    case 'timeout':
    case 'network':
      return 'We couldn’t securely save your report yet. Your answers are still here. Please try again.'
    case 'server':
    case 'malformed_response':
    default:
      return 'We couldn’t securely save your report yet. Your answers are still here. Please try again.'
  }
}

function classifyHttpStatus(status: number): FamilyCrmSubmitFailure['code'] {
  if (status === 429) return 'rate_limited'
  if (status === 413) return 'payload_too_large'
  if (status >= 400 && status < 500) return 'validation'
  return 'server'
}

/**
 * Browser adapter for the Family Report Card CRM ingest API.
 * Never imports server modules. Never writes to Google Sheets from the browser.
 */
export async function submitFamilyReportCardToCrm(
  body: FamilyReportCardClientIngestBody,
  options: SubmitFamilyReportCardToCrmOptions = {},
): Promise<FamilyCrmSubmitResult> {
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
    const sheetsSync = record.sheetsSync
    let sheetsSyncStatus: string | null = null
    if (typeof sheetsSync === 'string') {
      sheetsSyncStatus = sheetsSync
    } else if (sheetsSync && typeof sheetsSync === 'object') {
      const status = (sheetsSync as { status?: unknown }).status
      sheetsSyncStatus = typeof status === 'string' ? status : null
    }

    return {
      ok: true,
      created: record.created === true,
      submissionId: typeof record.submissionId === 'string' ? record.submissionId : body.submissionId,
      assessmentId: typeof record.assessmentId === 'string' ? record.assessmentId : null,
      matchStatus: typeof record.matchStatus === 'string' ? record.matchStatus : null,
      sheetsSyncStatus,
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
