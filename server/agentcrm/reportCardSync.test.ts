import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AGENTCRM_CONTACT_CREATION_ENV } from './contactCreationGate'
import { AGENTCRM_CONTACT_LINKING_ENV } from './contactLinkGate'
import { AGENTCRM_CONTACT_TAGGING_ENV } from './contactTaggingGate'
import { runReportCardAgentCrmSync, type ReportCardSyncDeps, type ReportCardSyncInput } from './reportCardSync'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'
const EXTERNAL_ID = 'ext-do-not-expose'
const CRM_DEV = 'https://cxgiaevervjttbuiramd.supabase.co'
const CRM_PROD = 'https://phanoknohbidqtgrpwvk.supabase.co'

const INPUT: ReportCardSyncInput = {
  assessmentType: 'student_loan',
  matchStatus: 'new_prospect',
  memberId: MEMBER_ID,
  submissionId: '550e8400-e29b-41d4-a716-446655440004',
  firstName: 'Jamie',
  lastName: 'Rivera',
  email: 'jamie.rivera@example.com',
  phone: '+15552014488',
}

function linked(externalContactId = EXTERNAL_ID) {
  return {
    findByMember: vi.fn(async () => ({
      status: 'found' as const,
      link: { householdMemberId: MEMBER_ID, externalContactId },
    })),
    saveVerifiedLink: vi.fn(),
  }
}

function quiet(deps: ReportCardSyncDeps = {}): ReportCardSyncDeps {
  return { log: () => {}, locationId: 'loc-test', ...deps }
}

describe('runReportCardAgentCrmSync', () => {
  it('does nothing for an unsupported or disabled Report Card', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const links = linked()
    const unsupported = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'family' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    const disabled = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links,
        resolveConfig: () => ({
          assessmentType: 'student_loan',
          source: 'Student Loan Report Card',
          serviceTag: 'service-student-loans',
          enabled: false,
        }),
      }),
    )
    expect(unsupported).toBeNull()
    expect(disabled).toBeNull()
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(links.findByMember).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('does nothing for possible_match, a missing member, or missing identity', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const links = linked()
    const deps = quiet({
      linkingEnabled: true,
      creationEnabled: true,
      taggingEnabled: true,
      lookupIdentity,
      createContact,
      applyTag,
      links,
    })
    const possible = await runReportCardAgentCrmSync({ ...INPUT, matchStatus: 'possible_match' }, deps)
    const replay = await runReportCardAgentCrmSync({ ...INPUT, memberId: null }, deps)
    const noEmail = await runReportCardAgentCrmSync({ ...INPUT, email: null }, deps)
    const noPhone = await runReportCardAgentCrmSync({ ...INPUT, phone: ' ' }, deps)
    expect(possible).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(replay).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
    expect(noEmail).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(noPhone).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(links.findByMember).not.toHaveBeenCalled()
  })

  it('tags an existing durable link without searching or creating', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const links = linked()
    const decision = await runReportCardAgentCrmSync(
      INPUT,
      quiet({ linkingEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    expect(decision).toEqual({ status: 'ALREADY_LINKED' })
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(applyTag).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledWith(EXTERNAL_ID)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('links an exact contact before tagging it', async () => {
    const order: string[] = []
    const decision = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => {
          order.push('identity')
          return { status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: EXTERNAL_ID }
        },
        applyTag: async () => {
          order.push('tag')
        },
        links: {
          findByMember: async () => {
            order.push('link-read')
            return { status: 'not_found' as const }
          },
          saveVerifiedLink: async () => {
            order.push('link')
            return { status: 'created' as const }
          },
        },
      }),
    )
    expect(decision).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(order).toEqual(['link-read', 'identity', 'link', 'tag'])
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
  })

  it('creates, links, and then tags when no contact exists', async () => {
    const order: string[] = []
    const createContact = vi.fn(async (input: { source?: string }) => {
      order.push('create')
      expect(input.source).toBe('Student Loan Report Card')
      return { id: 'ext-created', sourceMatched: true }
    })
    const decision = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact,
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
    expect(order).toEqual(['create', 'link', 'tag'])
    expect(JSON.stringify(decision)).not.toContain('ext-created')
  })

  it('does not create when creation or linking is off, and does not tag when tagging is off', async () => {
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const creationOff = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: false,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact,
        applyTag,
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: vi.fn(),
        },
      }),
    )
    const linkingOff = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: false,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact,
        applyTag,
        links: linked(),
      }),
    )
    const taggingOff = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        taggingEnabled: false,
        applyTag,
        links: linked(),
      }),
    )
    expect(creationOff).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(linkingOff).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(taggingOff).toEqual({ status: 'ALREADY_LINKED' })
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
  })

  it('does not create, link, or tag an ambiguous or failed identity result', async () => {
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const saveVerifiedLink = vi.fn()
    const ambiguous = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'AMBIGUOUS' as const, reason: 'EMAIL_ONLY_MATCH' as const }),
        createContact,
        applyTag,
        links: { findByMember: async () => ({ status: 'not_found' as const }), saveVerifiedLink },
      }),
    )
    const failed = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'INTEGRATION_ERROR' as const, category: 'timeout' as const }),
        createContact,
        applyTag,
        links: { findByMember: async () => ({ status: 'not_found' as const }), saveVerifiedLink },
      }),
    )
    expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
    expect(JSON.stringify([ambiguous, failed])).not.toContain(EXTERNAL_ID)
  })

  it('does not tag a link conflict or a create that failed to link, and does not create twice', async () => {
    const applyTag = vi.fn()
    const conflict = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: EXTERNAL_ID }),
        applyTag,
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: async () => ({ status: 'conflict' as const }),
        },
      }),
    )
    const createContact = vi.fn(async () => ({ id: 'ext-created', sourceMatched: true }))
    const linkFailed = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact,
        applyTag,
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: async () => ({ status: 'error' as const }),
        },
      }),
    )
    expect(conflict).toEqual({ status: 'LINK_CONFLICT' })
    expect(linkFailed).toEqual({ status: 'CONTACT_CREATED_LINK_FAILED' })
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(applyTag).not.toHaveBeenCalled()
    expect(JSON.stringify([conflict, linkFailed])).not.toContain(EXTERNAL_ID)
    expect(JSON.stringify(linkFailed)).not.toContain('ext-created')
  })

  it('keeps the durable relationship when tagging fails', async () => {
    const saveVerifiedLink = vi.fn(async () => ({ status: 'created' as const }))
    const decision = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: EXTERNAL_ID }),
        applyTag: async () => {
          throw new Error(`tag failed ${EXTERNAL_ID} ${INPUT.email}`)
        },
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink,
        },
      }),
    )
    expect(decision).toEqual({ status: 'TAG_FAILED' })
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
    expect(JSON.stringify(decision)).not.toContain(INPUT.email ?? '')
  })

  it('blocks linking, creation, and tagging on the production host', async () => {
    const lookupIdentity = vi.fn(async () => ({ status: 'NO_CONTACT_FOUND' as const }))
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const links = linked()
    const decision = await runReportCardAgentCrmSync(INPUT, {
      log: () => {},
      lookupIdentity,
      createContact,
      applyTag,
      links,
      env: {
        [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
        [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
        [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
        SUPABASE_URL: CRM_PROD,
        AGENTCRM_LOCATION_ID: 'loc-test',
        AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'pit-test-placeholder',
      },
    })
    expect(decision).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(links.findByMember).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(lookupIdentity).toHaveBeenCalledTimes(1)
  })

  it('logs only the sanitized decision', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await runReportCardAgentCrmSync(INPUT, {
      linkingEnabled: true,
      taggingEnabled: true,
      locationId: 'loc-test',
      applyTag: async () => {},
      links: linked(),
    })
    const logged = JSON.stringify(spy.mock.calls)
    spy.mockRestore()
    expect(logged).toContain('ALREADY_LINKED')
    expect(logged).toContain('student_loan')
    expect(logged).not.toContain(INPUT.email ?? '')
    expect(logged).not.toContain(INPUT.phone ?? '')
    expect(logged).not.toContain(INPUT.firstName)
    expect(logged).not.toContain(INPUT.lastName)
    expect(logged).not.toContain(EXTERNAL_ID)
    expect(logged).not.toContain(MEMBER_ID)
  })

  it('keeps the engine free of contact updates, opportunities, workflows, and messages', () => {
    const engine = readFileSync(resolve(process.cwd(), 'server/agentcrm/reportCardSync.ts'), 'utf8')
    const config = readFileSync(resolve(process.cwd(), 'server/agentcrm/reportCardSyncConfig.ts'), 'utf8')
    expect(engine).not.toMatch(/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
    expect(engine).not.toMatch(/tags:|customFields:|\/conversations\/messages|opportunity|workflow|dnd/)
    expect(config).toContain('credit')
    expect(config).not.toMatch(/family|business|protection|home_buyer|retirement/)
  })

  it('uses the Student Loan source and service tag through the real writers on CRM-dev', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof URL ? input : new URL(String(input))
      if (url.pathname === '/contacts/') {
        return new Response(
          JSON.stringify({
            contact: {
              id: 'syntheticContact1',
              locationId: 'loc-test',
              email: INPUT.email,
              phone: INPUT.phone,
              source: 'Student Loan Report Card',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ tags: ['service-student-loans'] }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const decision = await runReportCardAgentCrmSync(INPUT, {
        log: () => {},
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: async () => ({ status: 'created' as const }),
        },
        env: {
          [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
          [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
          [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
          SUPABASE_URL: CRM_DEV,
          AGENTCRM_LOCATION_ID: 'loc-test',
          AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'pit-test-placeholder',
        },
      })
      expect(decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      const createInit = fetchImpl.mock.calls[0]?.[1]
      const tagInit = fetchImpl.mock.calls[1]?.[1]
      if (!createInit || !tagInit) throw new Error('expected create and tag requests')
      const tagUrl = fetchImpl.mock.calls[1]?.[0]
      expect(JSON.parse(String(createInit.body))).toMatchObject({ source: 'Student Loan Report Card' })
      expect(JSON.parse(String(tagInit.body))).toEqual({ tags: ['service-student-loans'] })
      expect(String(tagUrl)).toContain('/contacts/syntheticContact1/tags')
      expect(String(tagUrl)).not.toContain('pit-test-placeholder')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('creates, links, and tags a new Credit person with the Credit source and tag', async () => {
    const order: string[] = []
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async (input) => {
          order.push('create')
          expect(input.source).toBe('Credit Report Card')
          return { id: 'ext-credit', sourceMatched: true }
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
    expect(order).toEqual(['create', 'link', 'tag'])
    expect(JSON.stringify(decision)).not.toContain('ext-credit')
  })

  it('links an exact Credit contact and does not update it', async () => {
    const createContact = vi.fn()
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({
        linkingEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: EXTERNAL_ID }),
        createContact,
        applyTag: async () => {},
        links: {
          findByMember: async () => ({ status: 'not_found' as const }),
          saveVerifiedLink: async () => ({ status: 'created' as const }),
        },
      }),
    )
    expect(decision).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(createContact).not.toHaveBeenCalled()
    expect(JSON.stringify(decision)).not.toContain(EXTERNAL_ID)
  })

  it('does not sync a Credit possible match, ambiguous identity, or integration error', async () => {
    const lookupIdentity = vi.fn(async (): Promise<
      | { status: 'AMBIGUOUS'; reason: 'EMAIL_ONLY_MATCH' }
      | { status: 'INTEGRATION_ERROR'; category: 'timeout' }
    > => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }))
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const saveVerifiedLink = vi.fn()
    const possible = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit', matchStatus: 'possible_match' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag }),
    )
    const ambiguous = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links: { findByMember: async () => ({ status: 'not_found' as const }), saveVerifiedLink },
      }),
    )
    lookupIdentity.mockResolvedValueOnce({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    const failed = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links: { findByMember: async () => ({ status: 'not_found' as const }), saveVerifiedLink },
      }),
    )
    expect(possible).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('tags an already linked Credit person without searching or creating', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const links = linked()
    const first = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    const second = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    expect(first).toEqual({ status: 'ALREADY_LINKED' })
    expect(second).toEqual({ status: 'ALREADY_LINKED' })
    expect(applyTag).toHaveBeenCalledTimes(2)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('adds the Credit tag to the same contact already linked from Student Loan', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'credit' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links: linked(),
      }),
    )
    expect(decision).toEqual({ status: 'ALREADY_LINKED' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledWith(EXTERNAL_ID)
  })

  it('posts only the Credit service tag and keeps an existing Student Loan tag in the response', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof URL ? input : new URL(String(input))
      if (url.pathname === '/contacts/') {
        return new Response(
          JSON.stringify({
            contact: {
              id: 'syntheticContact1',
              locationId: 'loc-test',
              email: INPUT.email,
              phone: INPUT.phone,
              source: 'Credit Report Card',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({ tags: ['service-student-loans', 'service-credit-improvement'] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'credit' },
        {
          log: () => {},
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
          env: {
            [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
            [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
            [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
            SUPABASE_URL: CRM_DEV,
            AGENTCRM_LOCATION_ID: 'loc-test',
            AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'pit-test-placeholder',
          },
        },
      )
      expect(decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
      const createInit = fetchImpl.mock.calls[0]?.[1]
      const tagInit = fetchImpl.mock.calls[1]?.[1]
      if (!createInit || !tagInit) throw new Error('expected create and tag requests')
      expect(JSON.parse(String(createInit.body))).toMatchObject({ source: 'Credit Report Card' })
      expect(JSON.parse(String(tagInit.body))).toEqual({ tags: ['service-credit-improvement'] })
      expect(JSON.stringify(createInit.body)).not.toMatch(/firstName.*update|customFields|opportunity/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
