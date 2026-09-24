import { normalizeEmail, normalizePhone } from '../../crm/households/normalizeContact.js'
import type { LeadConnectorClient } from './client.js'
import { findDuplicateContactByEmail, findDuplicateContactByPhone, type DuplicateContact } from './duplicateContact.js'
import { LeadConnectorError, type LeadConnectorErrorCategory } from './errors.js'

export type AgentCrmIdentityCandidate = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export type AgentCrmIdentityAmbiguousReason =
  | 'MISSING_IDENTITY_INPUT'
  | 'EMAIL_ONLY_MATCH'
  | 'PHONE_ONLY_MATCH'
  | 'DIFFERENT_CONTACTS'
  | 'CONTACT_FIELD_MISMATCH'
  | 'NAME_CONFLICT'

export type AgentCrmIdentityLookupResult =
  | {
      status: 'EXACT_EXISTING_CONTACT'
      externalContactId: string
    }
  | {
      status: 'NO_CONTACT_FOUND'
    }
  | {
      status: 'AMBIGUOUS'
      reason: AgentCrmIdentityAmbiguousReason
    }
  | {
      status: 'INTEGRATION_ERROR'
      category: LeadConnectorErrorCategory
    }

/**
 * Two independent duplicate searches, then a local reconciliation.
 * Email and phone are never sent on the same request.
 * The external contact id stays on this server result and is not a public field.
 */
export async function lookupAgentCrmIdentity(
  client: LeadConnectorClient,
  locationId: string,
  candidate: AgentCrmIdentityCandidate,
): Promise<AgentCrmIdentityLookupResult> {
  const normalizedEmail = normalizeEmail(candidate.email)
  const normalizedPhone = normalizePhone(candidate.phone)
  if (!normalizedEmail || !normalizedPhone) {
    return { status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' }
  }

  let emailContact: DuplicateContact | null
  try {
    emailContact = await findDuplicateContactByEmail(client, locationId, normalizedEmail)
  } catch (error) {
    return integrationError(error)
  }

  let phoneContact: DuplicateContact | null
  try {
    phoneContact = await findDuplicateContactByPhone(client, locationId, normalizedPhone)
  } catch (error) {
    return integrationError(error)
  }

  return classifyDuplicateContacts({
    candidate,
    normalizedEmail,
    normalizedPhone,
    emailContact,
    phoneContact,
  })
}

export function classifyDuplicateContacts(input: {
  candidate: AgentCrmIdentityCandidate
  normalizedEmail: string
  normalizedPhone: string
  emailContact: DuplicateContact | null
  phoneContact: DuplicateContact | null
}): AgentCrmIdentityLookupResult {
  const { candidate, normalizedEmail, normalizedPhone, emailContact, phoneContact } = input

  if (!emailContact && !phoneContact) return { status: 'NO_CONTACT_FOUND' }
  if (!emailContact) return { status: 'AMBIGUOUS', reason: 'PHONE_ONLY_MATCH' }
  if (!phoneContact) return { status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }
  if (emailContact.id !== phoneContact.id) return { status: 'AMBIGUOUS', reason: 'DIFFERENT_CONTACTS' }

  const emailAgrees =
    normalizeEmail(emailContact.email) === normalizedEmail &&
    normalizeEmail(phoneContact.email) === normalizedEmail
  const phoneAgrees =
    normalizePhone(emailContact.phone) === normalizedPhone &&
    normalizePhone(phoneContact.phone) === normalizedPhone
  if (!emailAgrees || !phoneAgrees) return { status: 'AMBIGUOUS', reason: 'CONTACT_FIELD_MISMATCH' }

  if (hasNameConflict(candidate, emailContact) || hasNameConflict(candidate, phoneContact)) {
    return { status: 'AMBIGUOUS', reason: 'NAME_CONFLICT' }
  }

  return { status: 'EXACT_EXISTING_CONTACT', externalContactId: emailContact.id }
}

/**
 * Same rule as household matching: a name conflicts only when the contact has
 * both a first and last name and neither matches the candidate. Comparison is
 * trimmed and case-insensitive. Empty contact names are not a conflict.
 */
function hasNameConflict(candidate: AgentCrmIdentityCandidate, contact: DuplicateContact): boolean {
  const contactFirst = contact.firstName?.trim() ?? ''
  const contactLast = contact.lastName?.trim() ?? ''
  if (!contactFirst || !contactLast) return false
  const firstMatches = looseNameMatch(contactFirst, candidate.firstName)
  const lastMatches = looseNameMatch(contactLast, candidate.lastName)
  return !firstMatches && !lastMatches
}

function looseNameMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  if (!left || !right) return false
  return left === right
}

function integrationError(error: unknown): AgentCrmIdentityLookupResult {
  if (error instanceof LeadConnectorError) {
    return { status: 'INTEGRATION_ERROR', category: error.category }
  }
  return { status: 'INTEGRATION_ERROR', category: 'network' }
}
