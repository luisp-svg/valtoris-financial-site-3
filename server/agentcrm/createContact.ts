import { normalizeEmail, normalizePhone } from '../../crm/households/normalizeContact.js'
import {
  LEADCONNECTOR_API_BASE_URL,
  LEADCONNECTOR_API_VERSION,
  LEADCONNECTOR_TIMEOUT_MS,
} from './constants.js'
import { readAgentCrmConfig } from './config.js'
import { isAgentCrmContactCreationEnabled } from './contactCreationGate.js'
import { categoryForStatus, LeadConnectorError } from './errors.js'
import {
  isEnabledReportCardContactSource,
  STUDENT_LOAN_CONTACT_SOURCE,
} from './reportCardSyncConfig.js'

export { STUDENT_LOAN_CONTACT_SOURCE }

export type CreateAgentCrmContactInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  /** Enabled Report Card source. Defaults to the Student Loan source. */
  source?: string
}

export type CreatedAgentCrmContact = {
  id: string
  /** True when the response source equals the submitted source. Null when the field is absent. */
  sourceMatched: boolean | null
}

export type CreateAgentCrmContactDeps = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

/**
 * Creates one AgentCRM contact with the minimum identity payload and an enabled Report Card source.
 * The generic client stays GET-only. This function posts only to create a contact.
 * It does not tag, enroll a workflow, or send a message.
 */
export async function createAgentCrmContact(
  input: CreateAgentCrmContactInput,
  deps: CreateAgentCrmContactDeps = {},
): Promise<CreatedAgentCrmContact> {
  const env = deps.env ?? process.env
  if (!isAgentCrmContactCreationEnabled(env)) {
    throw new LeadConnectorError('forbidden', null)
  }

  const config = readAgentCrmConfig(env)
  if (!config.configured) throw new LeadConnectorError('unauthorized', null)

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  if (!firstName || !lastName || !email || !phone) {
    throw new LeadConnectorError('invalid_response', null)
  }

  const source = (input.source ?? STUDENT_LOAN_CONTACT_SOURCE).trim()
  if (!isEnabledReportCardContactSource(source)) {
    throw new LeadConnectorError('forbidden', null)
  }

  const body = {
    locationId: config.locationId,
    firstName,
    lastName,
    email,
    phone,
    source,
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? LEADCONNECTOR_TIMEOUT_MS
  const baseUrl = (deps.baseUrl ?? LEADCONNECTOR_API_BASE_URL).replace(/\/$/, '')
  const url = new URL(`${baseUrl}/contacts/`)
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
      body: JSON.stringify(body),
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

  return parseCreatedContact(payload, { email, phone, locationId: config.locationId, source })
}

function parseCreatedContact(
  payload: unknown,
  expected: { email: string; phone: string; locationId: string; source: string },
): CreatedAgentCrmContact {
  const root = asRecord(payload)
  const contact = root ? asRecord(root.contact) : null
  if (!root || !contact) throw new LeadConnectorError('invalid_response', 201)

  const id = readRequiredString(contact.id)
  if (!id) throw new LeadConnectorError('invalid_response', 201)

  const email = readRequiredString(contact.email)
  const phone = readRequiredString(contact.phone)
  const locationId = readRequiredString(contact.locationId)
  if (!email || !phone || !locationId) throw new LeadConnectorError('invalid_response', 201)
  if (normalizeEmail(email) !== expected.email) throw new LeadConnectorError('invalid_response', 201)
  if (normalizePhone(phone) !== expected.phone) throw new LeadConnectorError('invalid_response', 201)
  if (locationId !== expected.locationId) throw new LeadConnectorError('invalid_response', 201)

  let sourceMatched: boolean | null = null
  if (Object.prototype.hasOwnProperty.call(contact, 'source') && contact.source != null) {
    if (typeof contact.source !== 'string') throw new LeadConnectorError('invalid_response', 201)
    sourceMatched = contact.source === expected.source
  }

  return { id, sourceMatched }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
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
