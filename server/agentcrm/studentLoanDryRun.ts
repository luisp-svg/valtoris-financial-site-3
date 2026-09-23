import { LeadConnectorClient } from './client.js'
import { readAgentCrmConfig, type AgentCrmConfig } from './config.js'
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
  | { status: 'EXACT_EXISTING_CONTACT' }
  | { status: 'NO_CONTACT_FOUND' }
  | { status: 'AMBIGUOUS'; reason: AgentCrmIdentityAmbiguousReason }
  | { status: 'INTEGRATION_ERROR'; category: LeadConnectorErrorCategory | 'not_configured' }

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
  log?: (event: StudentLoanDryRunLogEvent) => void
}

export type StudentLoanDryRunLogEvent = {
  submissionId: string
  assessmentType: 'student_loan'
  decision: StudentLoanAgentCrmDryRunDecision['status']
  category: string | null
}

/**
 * Decides what a future Student Loan AgentCRM sync would do.
 * Reads only. Does not store an external contact link or send an AgentCRM request body.
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
  } catch {
    return { status: 'INTEGRATION_ERROR', category: 'network' }
  }
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
