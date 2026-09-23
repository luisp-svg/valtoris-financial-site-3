import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { runStudentLoanAgentCrmDryRun, type StudentLoanDryRunDeps, type StudentLoanDryRunInput } from './studentLoanDryRun'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'
const EXTERNAL_ID = 'ext-do-not-expose'

const INPUT: StudentLoanDryRunInput = {
  assessmentType: 'student_loan',
  matchStatus: 'new_prospect',
  memberId: MEMBER_ID,
  submissionId: '550e8400-e29b-41d4-a716-446655440004',
  firstName: 'Jamie',
  lastName: 'Rivera',
  email: 'jamie.rivera@example.com',
  phone: '+15552014488',
}

function off(deps: StudentLoanDryRunDeps = {}): StudentLoanDryRunDeps {
  return { syncEnabled: true, linkingEnabled: false, log: () => {}, ...deps }
}

function on(deps: StudentLoanDryRunDeps = {}): StudentLoanDryRunDeps {
  return {
    syncEnabled: true,
    linkingEnabled: true,
    creationEnabled: false,
    taggingEnabled: false,
    locationId: 'loc-test',
    log: () => {},
    ...deps,
  }
}

describe('runStudentLoanAgentCrmDryRun', () => {
  it('does not look up or link when the master switch is on and linking is off', async () => {
    const lookupIdentity = vi.fn(async () => ({
      status: 'EXACT_EXISTING_CONTACT' as const,
      externalContactId: EXTERNAL_ID,
    }))
    const findByMember = vi.fn()
    const saveVerifiedLink = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      off({ lookupIdentity, links: { findByMember, saveVerifiedLink } }),
    )
    expect(decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(findByMember).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('does not look up a missing contact when linking is off', async () => {
    const lookupIdentity = vi.fn(async () => ({ status: 'NO_CONTACT_FOUND' as const }))
    const decision = await runStudentLoanAgentCrmDryRun(INPUT, off({ lookupIdentity }))
    expect(decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(lookupIdentity).not.toHaveBeenCalled()
  })

  it('does not look up an exact trusted match when linking is off', async () => {
    const lookupIdentity = vi.fn(async () => ({
      status: 'EXACT_EXISTING_CONTACT' as const,
      externalContactId: 'hidden-id',
    }))
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, matchStatus: 'exact_trusted_match' },
      off({ lookupIdentity }),
    )
    expect(decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(lookupIdentity).not.toHaveBeenCalled()
  })

  it('skips possible_match without calling the classifier or the link table', async () => {
    const lookupIdentity = vi.fn()
    const findByMember = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, matchStatus: 'possible_match' },
      on({ lookupIdentity, links: { findByMember, saveVerifiedLink: vi.fn() } }),
    )
    expect(decision).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(findByMember).not.toHaveBeenCalled()
  })

  it('skips a null member id without calling the classifier or the link table', async () => {
    const lookupIdentity = vi.fn()
    const findByMember = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, memberId: null },
      on({ lookupIdentity, links: { findByMember, saveVerifiedLink: vi.fn() } }),
    )
    expect(decision).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(findByMember).not.toHaveBeenCalled()
  })

  it('does not call AgentCRM when email or phone is missing', async () => {
    const lookupIdentity = vi.fn()
    const findByMember = vi.fn()
    const createContact = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, email: null },
      on({
        creationEnabled: true,
        lookupIdentity,
        createContact,
        links: { findByMember, saveVerifiedLink: vi.fn() },
      }),
    )
    expect(decision).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(findByMember).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
  })

  it('maps an ambiguous classifier result and does not link', async () => {
    const saveVerifiedLink = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: async () => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }),
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    expect(decision).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('maps an integration error and a thrown timeout without leaking the candidate', async () => {
    const saveVerifiedLink = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: async () => ({ status: 'INTEGRATION_ERROR', category: 'timeout' }),
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    expect(decision).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(saveVerifiedLink).not.toHaveBeenCalled()

    const throwing = vi.fn(async () => {
      throw new Error(`timeout for ${INPUT.email}`)
    })
    const thrown = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: throwing,
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink: vi.fn() },
      }),
    )
    expect(thrown).toEqual({ status: 'INTEGRATION_ERROR', category: 'network' })
    expect(JSON.stringify(thrown)).not.toContain(INPUT.email)
  })

  it('returns ALREADY_LINKED and does not call the classifier when a link exists', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        lookupIdentity,
        createContact,
        links: {
          findByMember: async () => ({
            status: 'found',
            link: { householdMemberId: MEMBER_ID, externalContactId: EXTERNAL_ID },
          }),
          saveVerifiedLink: vi.fn(),
        },
      }),
    )
    expect(decision).toEqual({ status: 'ALREADY_LINKED' })
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
  })

  it('links an exact existing contact and repeats that relationship without another search', async () => {
    let saved: { householdMemberId: string; externalContactId: string } | null = null
    const lookupIdentity = vi.fn(async () => ({
      status: 'EXACT_EXISTING_CONTACT' as const,
      externalContactId: EXTERNAL_ID,
    }))
    const links = {
      findByMember: vi.fn(async () =>
        saved
          ? { status: 'found' as const, link: saved }
          : { status: 'not_found' as const },
      ),
      saveVerifiedLink: vi.fn(async (input: { householdMemberId: string; externalContactId: string }) => {
        saved = { householdMemberId: input.householdMemberId, externalContactId: input.externalContactId }
        return { status: 'created' as const }
      }),
    }

    const created = await runStudentLoanAgentCrmDryRun(INPUT, on({ lookupIdentity, links }))
    const repeated = await runStudentLoanAgentCrmDryRun(INPUT, on({ lookupIdentity, links }))

    expect(created).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(repeated).toEqual({ status: 'ALREADY_LINKED' })
    expect(JSON.stringify(created)).not.toContain(EXTERNAL_ID)
    expect(lookupIdentity).toHaveBeenCalledTimes(1)
    expect(links.saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(links.saveVerifiedLink).toHaveBeenCalledWith({
      provider: 'agentcrm',
      locationId: 'loc-test',
      householdMemberId: MEMBER_ID,
      externalContactId: EXTERNAL_ID,
    })
  })

  it('maps a same-pair insert race to ALREADY_LINKED and a different mapping to LINK_CONFLICT', async () => {
    const same = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT', externalContactId: EXTERNAL_ID }),
        links: {
          findByMember: async () => ({ status: 'not_found' }),
          saveVerifiedLink: async () => ({ status: 'already_linked' }),
        },
      }),
    )
    expect(same).toEqual({ status: 'ALREADY_LINKED' })

    const saveVerifiedLink = vi.fn(async () => ({ status: 'conflict' as const }))
    const conflict = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT', externalContactId: EXTERNAL_ID }),
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    expect(conflict).toEqual({ status: 'LINK_CONFLICT' })
    expect(JSON.stringify(conflict)).not.toContain(EXTERNAL_ID)
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
  })

  it('does not link when no contact exists and creation is disabled', async () => {
    const saveVerifiedLink = vi.fn()
    const createContact = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: false,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' }),
        createContact,
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    expect(decision).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(saveVerifiedLink).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
  })

  it('does not create a contact when linking is disabled', async () => {
    const createContact = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      off({
        creationEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' }),
        createContact,
      }),
    )
    expect(decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(createContact).not.toHaveBeenCalled()
  })

  it('creates one contact and links it when both gates are enabled', async () => {
    const createContact = vi.fn(async (contact: { firstName: string; lastName: string; email: string; phone: string; source?: string }) => {
      expect(Object.keys(contact).sort()).toEqual(['email', 'firstName', 'lastName', 'phone', 'source'])
      expect(contact.source).toBe('Student Loan Report Card')
      return { id: 'ext-created', sourceMatched: true }
    })
    const saveVerifiedLink = vi.fn(async () => ({ status: 'created' as const }))
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact,
        links: { findByMember: async () => ({ status: 'not_found' as const }), saveVerifiedLink },
      }),
    )
    expect(decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
    expect(JSON.stringify(decision)).not.toContain('ext-created')
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(saveVerifiedLink).toHaveBeenCalledWith({
      provider: 'agentcrm',
      locationId: 'loc-test',
      householdMemberId: MEMBER_ID,
      externalContactId: 'ext-created',
    })
  })

  it('does not create or link an ambiguous or failed classifier result', async () => {
    const createContact = vi.fn()
    const saveVerifiedLink = vi.fn()
    const ambiguous = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        lookupIdentity: async () => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }),
        createContact,
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    const failed = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        lookupIdentity: async () => ({ status: 'INTEGRATION_ERROR', category: 'timeout' }),
        createContact,
        links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink },
      }),
    )
    expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(createContact).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('records a link failure after one create and recovers on the next search without creating again', async () => {
    let agentContactId: string | null = null
    let linked = false
    const createContact = vi.fn(async () => {
      agentContactId = 'ext-created'
      return { id: 'ext-created', sourceMatched: true }
    })
    const lookupIdentity = vi.fn(async () =>
      agentContactId
        ? { status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: agentContactId }
        : { status: 'NO_CONTACT_FOUND' as const },
    )
    const links = {
      findByMember: vi.fn(async () =>
        linked
          ? { status: 'found' as const, link: { householdMemberId: MEMBER_ID, externalContactId: 'ext-created' } }
          : { status: 'not_found' as const },
      ),
      saveVerifiedLink: vi.fn(async () => {
        if (!linked) return { status: 'error' as const }
        return { status: 'created' as const }
      }),
    }
    const deps = on({ creationEnabled: true, lookupIdentity, createContact, links })
    const first = await runStudentLoanAgentCrmDryRun(INPUT, deps)
    expect(first).toEqual({ status: 'CONTACT_CREATED_LINK_FAILED' })
    expect(JSON.stringify(first)).not.toContain('ext-created')
    expect(createContact).toHaveBeenCalledTimes(1)

    links.saveVerifiedLink.mockImplementation(async () => {
      linked = true
      return { status: 'created' as const }
    })
    const second = await runStudentLoanAgentCrmDryRun(INPUT, deps)
    expect(second).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(createContact).toHaveBeenCalledTimes(1)

    const third = await runStudentLoanAgentCrmDryRun(INPUT, deps)
    expect(third).toEqual({ status: 'ALREADY_LINKED' })
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(lookupIdentity).toHaveBeenCalledTimes(2)
  })

  it('returns an integration error when the link insert fails and does not leak the contact id', async () => {
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT', externalContactId: EXTERNAL_ID }),
        links: {
          findByMember: async () => ({ status: 'not_found' }),
          saveVerifiedLink: async () => {
            throw new Error(`insert failed ${EXTERNAL_ID} ${INPUT.email}`)
          },
        },
      }),
    )
    expect(decision).toEqual({ status: 'INTEGRATION_ERROR', category: 'network' })
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(JSON.stringify(decision)).not.toContain(INPUT.email)
  })

  it('does not call the classifier or the link table for an inactive report card', async () => {
    const lookupIdentity = vi.fn()
    const findByMember = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, assessmentType: 'not_a_report_card' },
      on({ lookupIdentity, links: { findByMember, saveVerifiedLink: vi.fn() } }),
    )
    expect(decision).toBeNull()
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(findByMember).not.toHaveBeenCalled()
  })

  it('logs only the sanitized decision', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await runStudentLoanAgentCrmDryRun(INPUT, {
      linkingEnabled: false,
      lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' }),
    })
    expect(info).toHaveBeenCalledTimes(1)
    const payload = JSON.stringify(info.mock.calls[0])
    expect(payload).toContain('SKIP_SYNC_DISABLED')
    expect(payload).toContain(INPUT.submissionId)
    expect(payload).not.toContain(INPUT.email)
    expect(payload).not.toContain(INPUT.phone)
    expect(payload).not.toContain(INPUT.firstName)
    expect(payload).not.toContain(MEMBER_ID)
    info.mockRestore()
  })

  it('tags an already linked contact once and does not search or create', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links: {
          findByMember: async () => ({
            status: 'found',
            link: { householdMemberId: MEMBER_ID, externalContactId: EXTERNAL_ID },
          }),
          saveVerifiedLink: vi.fn(),
        },
      }),
    )
    expect(decision).toEqual({ status: 'ALREADY_LINKED' })
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(applyTag).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledWith(EXTERNAL_ID)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
  })

  it('links an exact contact before tagging it', async () => {
    const order: string[] = []
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT', externalContactId: EXTERNAL_ID }),
        applyTag: async () => {
          order.push('tag')
        },
        links: {
          findByMember: async () => ({ status: 'not_found' }),
          saveVerifiedLink: async () => {
            order.push('link')
            return { status: 'created' as const }
          },
        },
      }),
    )
    expect(decision).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(order).toEqual(['link', 'tag'])
  })

  it('creates, links, and then tags a new contact', async () => {
    const order: string[] = []
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async () => {
          order.push('create')
          return { id: 'ext-created', sourceMatched: true }
        },
        applyTag: async () => {
          order.push('tag')
        },
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: async () => {
            order.push('link')
            return { status: 'created' as const }
          },
        },
      }),
    )
    expect(decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
    expect(JSON.stringify(decision)).not.toContain('ext-created')
    expect(order).toEqual(['create', 'link', 'tag'])
  })

  it('does not tag when the tagging gate is off or the host is production', async () => {
    const applyTag = vi.fn()
    const linked = {
      findByMember: async () => ({
        status: 'found' as const,
        link: { householdMemberId: MEMBER_ID, externalContactId: EXTERNAL_ID },
      }),
      saveVerifiedLink: vi.fn(),
    }
    const disabled = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({ taggingEnabled: false, applyTag, links: linked }),
    )
    const production = await runStudentLoanAgentCrmDryRun(INPUT, {
      linkingEnabled: true,
      locationId: 'loc-test',
      log: () => {},
      applyTag,
      env: {
        AGENTCRM_CONTACT_TAGGING_ENABLED: 'true',
        SUPABASE_URL: 'https://phanoknohbidqtgrpwvk.supabase.co',
      },
      links: linked,
    })
    expect(disabled).toEqual({ status: 'ALREADY_LINKED' })
    expect(production).toEqual({ status: 'SKIP_SYNC_DISABLED' })
    expect(applyTag).not.toHaveBeenCalled()
  })

  it('does not tag skipped, ambiguous, failed, or conflicting results', async () => {
    const applyTag = vi.fn()
    const cases = [
      runStudentLoanAgentCrmDryRun(
        { ...INPUT, matchStatus: 'possible_match' },
        on({ taggingEnabled: true, applyTag }),
      ),
      runStudentLoanAgentCrmDryRun(
        { ...INPUT, memberId: null },
        on({ taggingEnabled: true, applyTag }),
      ),
      runStudentLoanAgentCrmDryRun(
        INPUT,
        on({
          taggingEnabled: true,
          applyTag,
          lookupIdentity: async () => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }),
          links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink: vi.fn() },
        }),
      ),
      runStudentLoanAgentCrmDryRun(
        INPUT,
        on({
          taggingEnabled: true,
          applyTag,
          lookupIdentity: async () => ({ status: 'INTEGRATION_ERROR', category: 'timeout' }),
          links: { findByMember: async () => ({ status: 'not_found' }), saveVerifiedLink: vi.fn() },
        }),
      ),
      runStudentLoanAgentCrmDryRun(
        INPUT,
        on({
          taggingEnabled: true,
          applyTag,
          lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT', externalContactId: EXTERNAL_ID }),
          links: {
            findByMember: async () => ({ status: 'not_found' }),
            saveVerifiedLink: async () => ({ status: 'conflict' as const }),
          },
        }),
      ),
      runStudentLoanAgentCrmDryRun(
        INPUT,
        on({
          creationEnabled: true,
          taggingEnabled: true,
          applyTag,
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          createContact: async () => ({ id: 'ext-created', sourceMatched: true }),
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'error' as const }),
          },
        }),
      ),
      runStudentLoanAgentCrmDryRun(
        { ...INPUT, assessmentType: 'not_a_report_card' },
        on({ taggingEnabled: true, applyTag }),
      ),
    ]
    const results = await Promise.all(cases)
    expect(results[4]).toEqual({ status: 'LINK_CONFLICT' })
    expect(results[5]).toEqual({ status: 'CONTACT_CREATED_LINK_FAILED' })
    expect(results[6]).toBeNull()
    expect(applyTag).not.toHaveBeenCalled()
    expect(JSON.stringify(results)).not.toContain('ext-created')
    expect(JSON.stringify(results)).not.toContain(EXTERNAL_ID)
  })

  it('keeps the link when tagging fails and reapplies on the next linked run', async () => {
    const applyTag = vi.fn()
      .mockRejectedValueOnce(new Error(`tag failed ${EXTERNAL_ID} ${INPUT.email}`))
      .mockResolvedValue(undefined)
    const saveVerifiedLink = vi.fn(async () => ({ status: 'created' as const }))
    const links = {
      findByMember: async () => ({
        status: 'found' as const,
        link: { householdMemberId: MEMBER_ID, externalContactId: EXTERNAL_ID },
      }),
      saveVerifiedLink,
    }
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const deps = on({ taggingEnabled: true, applyTag, links, lookupIdentity, createContact })
    const first = await runStudentLoanAgentCrmDryRun(INPUT, deps)
    const second = await runStudentLoanAgentCrmDryRun(INPUT, deps)
    expect(first).toEqual({ status: 'TAG_FAILED' })
    expect(JSON.stringify(first)).not.toContain(EXTERNAL_ID)
    expect(JSON.stringify(first)).not.toContain(INPUT.email)
    expect(second).toEqual({ status: 'ALREADY_LINKED' })
    expect(applyTag).toHaveBeenCalledTimes(2)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('keeps the Student Loan source and service tag on the enabled configuration', async () => {
    const { getReportCardAgentCrmConfig } = await import('./reportCardSyncConfig')
    const config = getReportCardAgentCrmConfig('student_loan')
    expect(config).toEqual({
      assessmentType: 'student_loan',
      source: 'Student Loan Report Card',
      serviceTag: 'service-student-loans',
      enabled: true,
    })
    const createContact = vi.fn(async (input: { source?: string }) => {
      expect(input.source).toBe('Student Loan Report Card')
      return { id: 'ext-created', sourceMatched: true }
    })
    const order: string[] = []
    const decision = await runStudentLoanAgentCrmDryRun(
      INPUT,
      on({
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async (input) => {
          order.push('create')
          return createContact(input)
        },
        applyTag: async () => {
          order.push('tag')
        },
        links: {
          findByMember: async () => {
            order.push('lookup-link')
            return { status: 'not_found' as const }
          },
          saveVerifiedLink: async () => {
            order.push('link')
            return { status: 'created' as const }
          },
        },
      }),
    )
    expect(decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
    expect(order).toEqual(['lookup-link', 'create', 'link', 'tag'])
    expect(createContact).toHaveBeenCalledTimes(1)
  })

  it('keeps AgentCRM free of write methods and keeps the link table out of ingest', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/agentcrm/studentLoanDryRun.ts'), 'utf8')
    const engine = readFileSync(resolve(process.cwd(), 'server/agentcrm/reportCardSync.ts'), 'utf8')
    const cardConfig = readFileSync(resolve(process.cwd(), 'server/agentcrm/reportCardSyncConfig.ts'), 'utf8')
    const links = readFileSync(resolve(process.cwd(), 'server/agentcrm/contactLinks.ts'), 'utf8')
    const ingest = readFileSync(
      resolve(process.cwd(), 'server/ingest/familyReportCard/ingestFamilyReportCard.ts'),
      'utf8',
    )
    const writeMethod = /method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/
    expect(source).not.toMatch(writeMethod)
    expect(source).not.toMatch(/tags:|customFields:|\/conversations\/messages|opportunity/)
    expect(engine).not.toMatch(writeMethod)
    expect(engine).not.toMatch(/tags:|customFields:|\/conversations\/messages|opportunity/)
    expect(cardConfig).not.toMatch(writeMethod)
    expect(cardConfig).toContain('service-student-loans')
    expect(cardConfig).toContain('credit:')
    expect(cardConfig).toContain('home_buyer:')
    expect(cardConfig).toContain('service-home-buyer-readiness')
    expect(cardConfig).toContain('protection:')
    expect(cardConfig).toContain('service-life-insurance')
    expect(cardConfig).toContain('business:')
    expect(cardConfig).toContain('service-business-planning')
    expect(cardConfig).toContain('family:')
    expect(cardConfig).toContain('service-family-planning')
    expect(cardConfig).toContain('retirement:')
    expect(cardConfig).toContain('service-retirement-planning')
    expect(cardConfig).not.toContain('Initial Financial Diagnostic')
    expect(cardConfig).not.toContain('service-annuities-retirement')
    expect(cardConfig).not.toContain('service-wills-trusts')
    expect(cardConfig).not.toContain('service-home-auto')
    expect(cardConfig).not.toContain('service-health-disability')
    expect(cardConfig).not.toContain('service-llc-setup')
    expect(cardConfig).not.toContain('service-tax-strategies')
    expect(cardConfig).not.toContain('service-payment-processing')
    expect(cardConfig).not.toContain('service-commercial-insurance')
    expect(cardConfig).not.toContain('service-employee-benefits')
    expect(links).not.toMatch(writeMethod)
    expect(links).not.toMatch(/\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/)
    expect(ingest).not.toContain('integration_contact_links')
    expect(links).toContain('integration_contact_links')
    expect(links).not.toMatch(/email|phone|first_name|last_name|token/)
  })
})
