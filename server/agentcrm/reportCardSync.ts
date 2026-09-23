import type { SupabaseClient } from '@supabase/supabase-js'
import { applyReportCardServiceTag } from './applyContactTag.js'
import { LeadConnectorClient } from './client.js'
import { readAgentCrmConfig, readAgentCrmLocationId, type AgentCrmConfig } from './config.js'
import { isAgentCrmContactCreationEnabled } from './contactCreationGate.js'
import { isAgentCrmContactLinkingEnabled } from './contactLinkGate.js'
import { isAgentCrmReportCardSyncEnabled } from './reportCardSyncGate.js'
import {
  AGENTCRM_LINK_PROVIDER,
  createIntegrationContactLinkRepository,
  type IntegrationContactLinkAdmin,
  type IntegrationContactLinkRepository,
} from './contactLinks.js'
import { isAgentCrmContactTaggingEnabled } from './contactTaggingGate.js'
import {
  createAgentCrmContact,
  type CreateAgentCrmContactInput,
  type CreatedAgentCrmContact,
} from './createContact.js'
import { LeadConnectorError, type LeadConnectorErrorCategory } from './errors.js'
import {
  lookupAgentCrmIdentity,
  type AgentCrmIdentityAmbiguousReason,
  type AgentCrmIdentityCandidate,
  type AgentCrmIdentityLookupResult,
} from './identityLookup.js'
import {
  getReportCardAgentCrmConfig,
  type ReportCardAgentCrmConfig,
} from './reportCardSyncConfig.js'

export type ReportCardSyncDecision =
  | { status: 'SKIP_POSSIBLE_MATCH' }
  | { status: 'SKIP_REPLAY_WITHOUT_MEMBER' }
  | { status: 'SKIP_SYNC_DISABLED' }
  | { status: 'SKIP_LINKING_DISABLED' }
  | { status: 'ALREADY_LINKED' }
  | { status: 'LINKED_EXISTING_CONTACT' }
  | { status: 'CREATED_AND_LINKED_CONTACT' }
  | { status: 'CONTACT_CREATED_LINK_FAILED' }
  | { status: 'TAG_FAILED' }
  | { status: 'EXACT_EXISTING_CONTACT' }
  | { status: 'NO_CONTACT_FOUND' }
  | { status: 'AMBIGUOUS'; reason: AgentCrmIdentityAmbiguousReason }
  | { status: 'LINK_CONFLICT' }
  | {
      status: 'INTEGRATION_ERROR'
      category: LeadConnectorErrorCategory | 'not_configured' | 'link_unavailable' | 'link_read_failed' | 'link_write_failed'
    }

export type ReportCardSyncInput = {
  assessmentType: string
  matchStatus: string
  memberId: string | null
  submissionId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export type ReportCardSyncDeps = {
  /** Test double for the read-only classifier. Production uses lookupAgentCrmIdentity. */
  lookupIdentity?: (candidate: AgentCrmIdentityCandidate) => Promise<AgentCrmIdentityLookupResult>
  readConfig?: (env?: NodeJS.ProcessEnv) => AgentCrmConfig
  /** Test override. Production reads AGENTCRM_REPORT_CARD_SYNC_ENABLED and the approved-host gate. */
  syncEnabled?: boolean
  /** Test override. Production reads AGENTCRM_CONTACT_LINKING_ENABLED, the master switch, and an approved host. */
  linkingEnabled?: boolean
  /** Test override. Production reads AGENTCRM_CONTACT_CREATION_ENABLED only when master sync and linking are on. */
  creationEnabled?: boolean
  /** Test double. Production uses createAgentCrmContact. */
  createContact?: (input: CreateAgentCrmContactInput) => Promise<CreatedAgentCrmContact>
  /** Test override. Production reads AGENTCRM_CONTACT_TAGGING_ENABLED, the master switch, and an approved host. */
  taggingEnabled?: boolean
  /** Test double. Production uses applyReportCardServiceTag with the configured service tag. */
  applyTag?: (contactId: string) => Promise<void>
  /** Test override. Production reads the Student Loan configuration and leaves every other card inactive. */
  resolveConfig?: (assessmentType: string) => ReportCardAgentCrmConfig | null
  env?: NodeJS.ProcessEnv
  /** Test override. Production reads AGENTCRM_LOCATION_ID. */
  locationId?: string | null
  links?: IntegrationContactLinkRepository
  /** Service-role client already used to persist the Report Card. Unused while linking is off. */
  admin?: SupabaseClient
  log?: (event: ReportCardSyncLogEvent) => void
}

export type ReportCardSyncLogEvent = {
  submissionId: string
  assessmentType: ReportCardAgentCrmConfig['assessmentType']
  decision: ReportCardSyncDecision['status']
  category: string | null
}

/**
 * After Valtoris persists a Report Card, sync one enabled card to an AgentCRM contact.
 * Disabled assessment types return before any AgentCRM call or link-table access.
 * The decision is not returned to the browser.
 */
export async function runReportCardAgentCrmSync(
  input: ReportCardSyncInput,
  deps: ReportCardSyncDeps = {},
): Promise<ReportCardSyncDecision | null> {
  const card = (deps.resolveConfig ?? getReportCardAgentCrmConfig)(input.assessmentType)
  if (!card?.enabled) return null

  const decision = await decide(input, deps, card)
  ;(deps.log ?? logSync)({
    submissionId: input.submissionId,
    assessmentType: card.assessmentType,
    decision: decision.status,
    category: 'category' in decision ? decision.category : 'reason' in decision ? decision.reason : null,
  })
  return decision
}

async function decide(
  input: ReportCardSyncInput,
  deps: ReportCardSyncDeps,
  card: ReportCardAgentCrmConfig,
): Promise<ReportCardSyncDecision> {
  if (input.matchStatus === 'possible_match') return { status: 'SKIP_POSSIBLE_MATCH' }

  const memberId = typeof input.memberId === 'string' ? input.memberId.trim() : ''
  if (!memberId) return { status: 'SKIP_REPLAY_WITHOUT_MEMBER' }

  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!email || !phone) return { status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' }

  const syncEnabled = deps.syncEnabled ?? isAgentCrmReportCardSyncEnabled(deps.env)
  if (!syncEnabled) return { status: 'SKIP_SYNC_DISABLED' }

  const linkingEnabled = deps.linkingEnabled ?? isAgentCrmContactLinkingEnabled(deps.env)
  if (!linkingEnabled) return { status: 'SKIP_LINKING_DISABLED' }

  try {
    return await classifyAndLink(input, deps, card, memberId, email, phone)
  } catch {
    return { status: 'INTEGRATION_ERROR', category: 'network' }
  }
}

async function classifyAndLink(
  input: ReportCardSyncInput,
  deps: ReportCardSyncDeps,
  card: ReportCardAgentCrmConfig,
  memberId: string,
  email: string,
  phone: string,
): Promise<ReportCardSyncDecision> {
  const locationId = deps.locationId ?? readAgentCrmLocationId(deps.env)
  if (!locationId) return { status: 'INTEGRATION_ERROR', category: 'not_configured' }

  const links = deps.links ?? (deps.admin ? createIntegrationContactLinkRepository(deps.admin as unknown as IntegrationContactLinkAdmin) : null)
  if (!links) return { status: 'INTEGRATION_ERROR', category: 'link_unavailable' }

  const existing = await links.findByMember({
    provider: AGENTCRM_LINK_PROVIDER,
    locationId,
    householdMemberId: memberId,
  })
  if (existing.status === 'error') return { status: 'INTEGRATION_ERROR', category: 'link_read_failed' }
  if (existing.status === 'found') {
    return tagLinkedContact(existing.link.externalContactId, deps, card, { status: 'ALREADY_LINKED' })
  }

  const lookup = deps.lookupIdentity ?? configuredLookup(deps)
  if (!lookup) return { status: 'INTEGRATION_ERROR', category: 'not_configured' }
  const result = await lookup({
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    phone,
  })
  if (result.status === 'AMBIGUOUS') return { status: 'AMBIGUOUS', reason: result.reason }
  if (result.status === 'INTEGRATION_ERROR') return { status: 'INTEGRATION_ERROR', category: result.category }
  if (result.status === 'NO_CONTACT_FOUND') {
    return createAndLinkNewContact(input, deps, card, links, locationId, memberId)
  }

  const externalContactId = result.externalContactId.trim()
  if (!externalContactId) return { status: 'INTEGRATION_ERROR', category: 'invalid_response' }

  const saved = await links.saveVerifiedLink({
    provider: AGENTCRM_LINK_PROVIDER,
    locationId,
    householdMemberId: memberId,
    externalContactId,
  })
  if (saved.status === 'created') {
    return tagLinkedContact(externalContactId, deps, card, { status: 'LINKED_EXISTING_CONTACT' })
  }
  if (saved.status === 'already_linked') {
    return tagLinkedContact(externalContactId, deps, card, { status: 'ALREADY_LINKED' })
  }
  if (saved.status === 'conflict') return { status: 'LINK_CONFLICT' }
  return { status: 'INTEGRATION_ERROR', category: 'link_write_failed' }
}

async function createAndLinkNewContact(
  input: ReportCardSyncInput,
  deps: ReportCardSyncDeps,
  card: ReportCardAgentCrmConfig,
  links: IntegrationContactLinkRepository,
  locationId: string,
  memberId: string,
): Promise<ReportCardSyncDecision> {
  const creationEnabled = deps.creationEnabled ?? isAgentCrmContactCreationEnabled(deps.env)
  if (!creationEnabled) return { status: 'NO_CONTACT_FOUND' }

  let created: CreatedAgentCrmContact
  try {
    const create = deps.createContact ?? ((contact: CreateAgentCrmContactInput) => createAgentCrmContact(contact, { env: deps.env }))
    created = await create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? '',
      phone: input.phone ?? '',
      source: card.source,
    })
  } catch (error) {
    if (error instanceof LeadConnectorError) {
      return { status: 'INTEGRATION_ERROR', category: error.category }
    }
    return { status: 'INTEGRATION_ERROR', category: 'network' }
  }

  const externalContactId = created.id.trim()
  if (!externalContactId) return { status: 'CONTACT_CREATED_LINK_FAILED' }

  try {
    const saved = await links.saveVerifiedLink({
      provider: AGENTCRM_LINK_PROVIDER,
      locationId,
      householdMemberId: memberId,
      externalContactId,
    })
    if (saved.status === 'created' || saved.status === 'already_linked') {
      return tagLinkedContact(externalContactId, deps, card, { status: 'CREATED_AND_LINKED_CONTACT' })
    }
    return { status: 'CONTACT_CREATED_LINK_FAILED' }
  } catch {
    return { status: 'CONTACT_CREATED_LINK_FAILED' }
  }
}

async function tagLinkedContact(
  contactId: string,
  deps: ReportCardSyncDeps,
  card: ReportCardAgentCrmConfig,
  success: ReportCardSyncDecision,
): Promise<ReportCardSyncDecision> {
  const taggingEnabled = deps.taggingEnabled ?? isAgentCrmContactTaggingEnabled(deps.env)
  if (!taggingEnabled) return success
  try {
    const apply =
      deps.applyTag ?? ((id: string) => applyReportCardServiceTag(id, card.serviceTag, { env: deps.env }))
    await apply(contactId)
    return success
  } catch {
    return { status: 'TAG_FAILED' }
  }
}

function configuredLookup(deps: ReportCardSyncDeps): ReportCardSyncDeps['lookupIdentity'] | null {
  const config = (deps.readConfig ?? readAgentCrmConfig)(deps.env)
  if (!config.configured) return null
  const client = new LeadConnectorClient({ token: config.token })
  const locationId = config.locationId
  return (candidate) => lookupAgentCrmIdentity(client, locationId, candidate)
}

function logSync(event: ReportCardSyncLogEvent): void {
  console.info('agentcrm report-card sync', {
    submissionId: event.submissionId,
    assessmentType: event.assessmentType,
    decision: event.decision,
    category: event.category,
  })
}
