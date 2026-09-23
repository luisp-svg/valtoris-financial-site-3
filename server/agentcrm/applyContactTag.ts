import {
  LEADCONNECTOR_API_BASE_URL,
  LEADCONNECTOR_API_VERSION,
  LEADCONNECTOR_TIMEOUT_MS,
} from './constants.js'
import { readAgentCrmConfig } from './config.js'
import { isAgentCrmContactTaggingEnabled } from './contactTaggingGate.js'
import { categoryForStatus, LeadConnectorError } from './errors.js'
import { isEnabledReportCardServiceTag, STUDENT_LOAN_SERVICE_TAG } from './reportCardSyncConfig.js'

export { STUDENT_LOAN_SERVICE_TAG }

export type ApplyStudentLoanServiceTagDeps = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

/**
 * Adds the existing Student Loan service tag to one contact.
 * Official contract: POST /contacts/{contactId}/tags, body { tags: string[] }, HTTP 201.
 * This is not a contact update and not a bulk tag write.
 */
export async function applyStudentLoanServiceTag(
  contactId: string,
  deps: ApplyStudentLoanServiceTagDeps = {},
): Promise<void> {
  return applyReportCardServiceTag(contactId, STUDENT_LOAN_SERVICE_TAG, deps)
}

/**
 * Adds one enabled Report Card service tag to an existing contact.
 * Official contract: POST /contacts/{contactId}/tags, body { tags: string[] }, HTTP 201.
 */
export async function applyReportCardServiceTag(
  contactId: string,
  serviceTag: string,
  deps: ApplyStudentLoanServiceTagDeps = {},
): Promise<void> {
  const env = deps.env ?? process.env
  if (!isAgentCrmContactTaggingEnabled(env)) {
    throw new LeadConnectorError('forbidden', null)
  }
  const tag = serviceTag.trim()
  if (!isEnabledReportCardServiceTag(tag)) {
    throw new LeadConnectorError('forbidden', null)
  }

  const config = readAgentCrmConfig(env)
  if (!config.configured) throw new LeadConnectorError('unauthorized', null)

  const id = contactId.trim()
  if (!id || id.length > 128 || /[/?#]/.test(id)) {
    throw new LeadConnectorError('invalid_response', null)
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? LEADCONNECTOR_TIMEOUT_MS
  const baseUrl = (deps.baseUrl ?? LEADCONNECTOR_API_BASE_URL).replace(/\/$/, '')
  const url = new URL(`${baseUrl}/contacts/${encodeURIComponent(id)}/tags`)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        Version: LEADCONNECTOR_API_VERSION,
      },
      body: JSON.stringify({ tags: [tag] }),
      signal: controller.signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw new LeadConnectorError('timeout', null)
    throw new LeadConnectorError('network', null)
  } finally {
    clearTimeout(timeout)
  }

  if (response.status !== 201) {
    await discardBody(response)
    throw new LeadConnectorError(categoryForStatus(response.status), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new LeadConnectorError('invalid_response', response.status)
  }
  assertTagApplied(payload, tag)
}

function assertTagApplied(payload: unknown, serviceTag: string): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LeadConnectorError('invalid_response', 201)
  }
  const tags = (payload as { tags?: unknown }).tags
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
    throw new LeadConnectorError('invalid_response', 201)
  }
  if (!tags.includes(serviceTag)) {
    throw new LeadConnectorError('invalid_response', 201)
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  )
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.arrayBuffer()
  } catch {
    // Ignore unreadable error bodies. Never surface them.
  }
}
