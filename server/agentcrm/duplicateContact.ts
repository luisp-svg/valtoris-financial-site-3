import type { LeadConnectorClient } from './client.js'
import { LeadConnectorError } from './errors.js'

/**
 * Fields kept from a duplicate-search contact.
 * Tags, custom fields, ids other than the contact id, and the raw body are dropped.
 */
export type DuplicateContact = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

/**
 * GET /contacts/search/duplicate with email only.
 * `contact: null` is no match. A malformed body is an integration failure.
 */
export async function findDuplicateContactByEmail(
  client: LeadConnectorClient,
  locationId: string,
  email: string,
): Promise<DuplicateContact | null> {
  assertLookupKey(locationId, email)
  const payload = await client.get('/contacts/search/duplicate', {
    locationId: locationId.trim(),
    email: email.trim(),
  })
  return parseDuplicateSearch(payload)
}

/**
 * GET /contacts/search/duplicate with phone only.
 * The phone query parameter is `number`. Email is not sent on this request.
 */
export async function findDuplicateContactByPhone(
  client: LeadConnectorClient,
  locationId: string,
  phone: string,
): Promise<DuplicateContact | null> {
  assertLookupKey(locationId, phone)
  const payload = await client.get('/contacts/search/duplicate', {
    locationId: locationId.trim(),
    number: phone.trim(),
  })
  return parseDuplicateSearch(payload)
}

function assertLookupKey(locationId: string, identifier: string): void {
  if (!locationId.trim() || !identifier.trim()) {
    throw new LeadConnectorError('invalid_response', null)
  }
}

export function parseDuplicateSearch(payload: unknown): DuplicateContact | null {
  const root = asRecord(payload)
  if (!root || !Object.prototype.hasOwnProperty.call(root, 'contact')) {
    throw new LeadConnectorError('invalid_response', null)
  }
  if (root.contact === null) return null

  const contact = asRecord(root.contact)
  if (!contact) throw new LeadConnectorError('invalid_response', null)

  const id = readRequiredString(contact.id)
  if (!id) throw new LeadConnectorError('invalid_response', null)

  return {
    id,
    firstName: readOptionalString(contact, 'firstName'),
    lastName: readOptionalString(contact, 'lastName'),
    email: readOptionalString(contact, 'email'),
    phone: readOptionalString(contact, 'phone'),
  }
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

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] == null) return null
  if (typeof record[key] !== 'string') throw new LeadConnectorError('invalid_response', null)
  const trimmed = record[key].trim()
  return trimmed ? trimmed : null
}
