import type { SupabaseClient } from '@supabase/supabase-js'
import { LeadConnectorClient } from './client.js'
import { isAgentCrmContactLinkingEnabled } from './contactLinkGate.js'
import {
  AGENTCRM_LINK_PROVIDER,
  createIntegrationContactLinkRepository,
  type IntegrationContactLinkAdmin,
  type IntegrationContactLinkRepository,
} from './contactLinks.js'
import { readAgentCrmConfig, readAgentCrmLocationId, type AgentCrmConfig } from './config.js'
import type { LeadConnectorErrorCategory } from './errors.js'
import {
  lookupAgentCrmIdentity,
  type AgentCrmIdentityAmbiguousReason,
  type AgentCrmIdentityCandidate,
  type AgentCrmIdentityLookupResult,
} from './identityLookup.js'

export type StudentLoanAgentCrmDryRunDecision =
  | { status: 'SKIP_POSSIBLE_MATCH' }
  | { status: 'SKIP_REPLAY_WITHOUT_MEMBER' }
  | { status: 'ALREADY_LINKED' }
  | { status: 'LINKED_EXISTING_CONTACT' }
  | { status: 'EXACT_EXISTING_CONTACT' }
  | { status: 'NO_CONTACT_FOUND' }
  | { status: 'AMBIGUOUS'; reason: AgentCrmIdentityAmbiguousReason }
  | { status: 'LINK_CONFLICT' }
  | {
      status: 'INTEGRATION_ERROR'
      category: LeadConnectorErrorCategory | 'not_configured' | 'link_unavailable' | 'link_read_failed' | 'link_write_failed'
    }

export type StudentLoanDryRunInput = {
  assessmentType: string
  matchStatus: string
  memberId: string | null
  submissionId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export type StudentLoanDryRunDeps = {
  /** Test double for the read-only classifier. Production uses lookupAgentCrmIdentity. */
  lookupIdentity?: (candidate: AgentCrmIdentityCandidate) => Promise<AgentCrmIdentityLookupResult>
  readConfig?: (env?: NodeJS.ProcessEnv) => AgentCrmConfig
  /** Test override. Production reads AGENTCRM_CONTACT_LINKING_ENABLED and the CRM-dev host gate. */
  linkingEnabled?: boolean
  /** Test override. Production reads AGENTCRM_LOCATION_ID. */
  locationId?: string | null
  links?: IntegrationContactLinkRepository
  /** Service-role client already used to persist the Report Card. Unused while linking is off. */
  admin?: SupabaseClient
  log?: (event: StudentLoanDryRunLogEvent) => void
}

export type StudentLoanDryRunLogEvent = {
  submissionId: string
  assessmentType: 'student_loan'
  decision: StudentLoanAgentCrmDryRunDecision['status']
  category: string | null
}

/**
 * After a Student Loan Report Card is saved, decide whether a verified
 * AgentCRM contact should be recorded in Valtoris. AgentCRM itself is read-only.
 * The decision is not returned to the browser.
 */
export async function runStudentLoanAgentCrmDryRun(
  input: StudentLoanDryRunInput,
  deps: StudentLoanDryRunDeps = {},
): Promise<StudentLoanAgentCrmDryRunDecision | null> {
  if (input.assessmentType !== 'student_loan') return null

  const decision = await decide(input, deps)
  ;(deps.log ?? logDryRun)({
    submissionId: input.submissionId,
    assessmentType: 'student_loan',
    decision: decision.status,
    category: 'category' in decision ? decision.category : 'reason' in decision ? decision.reason : null,
  })
  return decision
}

async function decide(
  input: StudentLoanDryRunInput,
  deps: StudentLoanDryRunDeps,
): Promise<StudentLoanAgentCrmDryRunDecision> {
  if (input.matchStatus === 'possible_match') return { status: 'SKIP_POSSIBLE_MATCH' }

  const memberId = typeof input.memberId === 'string' ? input.memberId.trim() : ''
  if (!memberId) return { status: 'SKIP_REPLAY_WITHOUT_MEMBER' }

  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!email || !phone) return { status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' }

  try {
    const linkingEnabled = deps.linkingEnabled ?? isAgentCrmContactLinkingEnabled()
    if (!linkingEnabled) return await classifyWithoutLink(input, deps, email, phone)
    return await classifyAndLink(input, deps, memberId, email, phone)
  } catch {
    return { status: 'INTEGRATION_ERROR', category: 'network' }
  }
}

async function classifyWithoutLink(
  input: StudentLoanDryRunInput,
  deps: StudentLoanDryRunDeps,
  email: string,
  phone: string,
): Promise<StudentLoanAgentCrmDryRunDecision> {
  const lookup = deps.lookupIdentity ?? configuredLookup(deps.readConfig)
  if (!lookup) return { status: 'INTEGRATION_ERROR', category: 'not_configured' }
  const result = await lookup({
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    phone,
  })
  if (result.status === 'EXACT_EXISTING_CONTACT') return { status: 'EXACT_EXISTING_CONTACT' }
  if (result.status === 'NO_CONTACT_FOUND') return { status: 'NO_CONTACT_FOUND' }
  if (result.status === 'AMBIGUOUS') return { status: 'AMBIGUOUS', reason: result.reason }
  return { status: 'INTEGRATION_ERROR', category: result.category }
}

async function classifyAndLink(
  input: StudentLoanDryRunInput,
  deps: StudentLoanDryRunDeps,
  memberId: string,
  email: string,
  phone: string,
): Promise<StudentLoanAgentCrmDryRunDecision> {
  const locationId = deps.locationId ?? readAgentCrmLocationId()
  if (!locationId) return { status: 'INTEGRATION_ERROR', category: 'not_configured' }

  const links = deps.links ?? (deps.admin ? createIntegrationContactLinkRepository(deps.admin as unknown as IntegrationContactLinkAdmin) : null)
  if (!links) return { status: 'INTEGRATION_ERROR', category: 'link_unavailable' }

  const existing = await links.findByMember({
    provider: AGENTCRM_LINK_PROVIDER,
    locationId,
    householdMemberId: memberId,
  })
  if (existing.status === 'error') return { status: 'INTEGRATION_ERROR', category: 'link_read_failed' }
  if (existing.status === 'found') return { status: 'ALREADY_LINKED' }

  const lookup = deps.lookupIdentity ?? configuredLookup(deps.readConfig)
  if (!lookup) return { status: 'INTEGRATION_ERROR', category: 'not_configured' }
  const result = await lookup({
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    phone,
  })
  if (result.status === 'NO_CONTACT_FOUND') return { status: 'NO_CONTACT_FOUND' }
  if (result.status === 'AMBIGUOUS') return { status: 'AMBIGUOUS', reason: result.reason }
  if (result.status === 'INTEGRATION_ERROR') return { status: 'INTEGRATION_ERROR', category: result.category }

  const externalContactId = result.externalContactId.trim()
  if (!externalContactId) return { status: 'INTEGRATION_ERROR', category: 'invalid_response' }

  const saved = await links.saveVerifiedLink({
    provider: AGENTCRM_LINK_PROVIDER,
    locationId,
    householdMemberId: memberId,
    externalContactId,
  })
  if (saved.status === 'created') return { status: 'LINKED_EXISTING_CONTACT' }
  if (saved.status === 'already_linked') return { status: 'ALREADY_LINKED' }
  if (saved.status === 'conflict') return { status: 'LINK_CONFLICT' }
  return { status: 'INTEGRATION_ERROR', category: 'link_write_failed' }
}

function configuredLookup(
  readConfig: StudentLoanDryRunDeps['readConfig'],
): StudentLoanDryRunDeps['lookupIdentity'] | null {
  const config = (readConfig ?? readAgentCrmConfig)()
  if (!config.configured) return null
  const client = new LeadConnectorClient({ token: config.token })
  const locationId = config.locationId
  return (candidate) => lookupAgentCrmIdentity(client, locationId, candidate)
}

function logDryRun(event: StudentLoanDryRunLogEvent): void {
  console.info('agentcrm student-loan dry-run', {
    submissionId: event.submissionId,
    assessmentType: event.assessmentType,
    decision: event.decision,
    category: event.category,
  })
}
