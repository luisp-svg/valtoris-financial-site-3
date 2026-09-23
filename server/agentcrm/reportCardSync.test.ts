import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AGENTCRM_CONTACT_CREATION_ENV } from './contactCreationGate'
import { AGENTCRM_CONTACT_LINKING_ENV } from './contactLinkGate'
import { AGENTCRM_REPORT_CARD_SYNC_ENV } from './reportCardSyncGate'
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
  return { log: () => {}, locationId: 'loc-test', syncEnabled: true, ...deps }
}

describe('runReportCardAgentCrmSync', () => {
  it('does nothing for an unsupported or disabled Report Card', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const links = linked()
    const unsupported = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'not_a_report_card' },
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
    const linkingLookup = vi.fn(async () => ({ status: 'NO_CONTACT_FOUND' as const }))
    const linkingOff = await runReportCardAgentCrmSync(
      INPUT,
      quiet({
        linkingEnabled: false,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: linkingLookup,
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
    expect(linkingOff).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(linkingLookup).not.toHaveBeenCalled()
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

  it('does not call AgentCRM when the master switch is missing or false', async () => {
    for (const master of [undefined, 'false', 'TRUE', '1']) {
      const lookupIdentity = vi.fn()
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
          ...(master === undefined ? {} : { [AGENTCRM_REPORT_CARD_SYNC_ENV]: master }),
          [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
          [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
          [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
          SUPABASE_URL: CRM_DEV,
          AGENTCRM_LOCATION_ID: 'loc-test',
          AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'pit-test-placeholder',
        },
      })
      expect(decision).toEqual({ status: 'SKIP_SYNC_DISABLED' })
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).not.toHaveBeenCalled()
      expect(links.findByMember).not.toHaveBeenCalled()
      expect(links.saveVerifiedLink).not.toHaveBeenCalled()
    }
  })

  it('keeps production inert unless every required gate is explicitly true', async () => {
    const flags = (
      master: string | undefined,
      linking: string | undefined,
      creation: string | undefined,
      tagging: string | undefined,
      host = CRM_PROD,
    ): NodeJS.ProcessEnv => ({
      ...(master === undefined ? {} : { [AGENTCRM_REPORT_CARD_SYNC_ENV]: master }),
      ...(linking === undefined ? {} : { [AGENTCRM_CONTACT_LINKING_ENV]: linking }),
      ...(creation === undefined ? {} : { [AGENTCRM_CONTACT_CREATION_ENV]: creation }),
      ...(tagging === undefined ? {} : { [AGENTCRM_CONTACT_TAGGING_ENV]: tagging }),
      SUPABASE_URL: host,
      AGENTCRM_LOCATION_ID: 'loc-test',
      AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'pit-test-placeholder',
    })

    const run = async (
      env: NodeJS.ProcessEnv,
      lookupStatus: 'NO_CONTACT_FOUND' | 'EXACT_EXISTING_CONTACT' = 'NO_CONTACT_FOUND',
    ) => {
      const lookupIdentity = vi.fn(async () =>
        lookupStatus === 'EXACT_EXISTING_CONTACT'
          ? ({ status: 'EXACT_EXISTING_CONTACT' as const, externalContactId: EXTERNAL_ID })
          : ({ status: 'NO_CONTACT_FOUND' as const }),
      )
      const createContact = vi.fn(async () => ({ id: 'ext-created', sourceMatched: true }))
      const applyTag = vi.fn(async () => {})
      const findByMember = vi.fn(async () => ({ status: 'not_found' as const }))
      const saveVerifiedLink = vi.fn(async () => ({ status: 'created' as const }))
      const decision = await runReportCardAgentCrmSync(INPUT, {
        log: () => {},
        lookupIdentity,
        createContact,
        applyTag,
        links: { findByMember, saveVerifiedLink },
        env,
      })
      return { decision, lookupIdentity, createContact, applyTag, findByMember, saveVerifiedLink }
    }

    const missing = await run(flags(undefined, 'true', 'true', 'true'))
    const disabled = await run(flags('false', 'true', 'true', 'true'))
    const unknownHost = await run(flags('true', 'true', 'true', 'true', 'https://other.supabase.co'))
    const suffixHost = await run(flags('true', 'true', 'true', 'true', 'https://phanoknohbidqtgrpwvk.supabase.co.evil.test'))
    expect(missing.decision).toEqual({ status: 'SKIP_SYNC_DISABLED' })
    expect(disabled.decision).toEqual({ status: 'SKIP_SYNC_DISABLED' })
    expect(unknownHost.decision).toEqual({ status: 'SKIP_SYNC_DISABLED' })
    expect(suffixHost.decision).toEqual({ status: 'SKIP_SYNC_DISABLED' })
    for (const result of [missing, disabled, unknownHost, suffixHost]) {
      expect(result.lookupIdentity).not.toHaveBeenCalled()
      expect(result.findByMember).not.toHaveBeenCalled()
      expect(result.createContact).not.toHaveBeenCalled()
      expect(result.applyTag).not.toHaveBeenCalled()
    }

    const linkingOff = await run(flags('true', 'false', 'true', 'true'))
    const linkingMissing = await run(flags('true', undefined, 'true', 'true'))
    expect(linkingOff.decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(linkingMissing.decision).toEqual({ status: 'SKIP_LINKING_DISABLED' })
    expect(linkingOff.lookupIdentity).not.toHaveBeenCalled()
    expect(linkingOff.findByMember).not.toHaveBeenCalled()
    expect(linkingOff.createContact).not.toHaveBeenCalled()
    expect(linkingOff.applyTag).not.toHaveBeenCalled()
    expect(linkingMissing.createContact).not.toHaveBeenCalled()

    const devRead = await run(flags('true', 'true', undefined, undefined, CRM_DEV))
    expect(devRead.decision).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(devRead.findByMember).toHaveBeenCalledTimes(1)
    expect(devRead.lookupIdentity).toHaveBeenCalledTimes(1)
    expect(devRead.createContact).not.toHaveBeenCalled()
    expect(devRead.applyTag).not.toHaveBeenCalled()

    const noCreate = await run(flags('true', 'true', 'false', 'true'))
    const exact = await run(flags('true', 'true', 'false', 'true'), 'EXACT_EXISTING_CONTACT')
    expect(noCreate.decision).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(noCreate.createContact).not.toHaveBeenCalled()
    expect(exact.decision).toEqual({ status: 'LINKED_EXISTING_CONTACT' })
    expect(exact.saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(exact.createContact).not.toHaveBeenCalled()
    expect(exact.applyTag).toHaveBeenCalledTimes(1)

    const noTag = await run(flags('true', 'true', 'true', 'false'))
    expect(noTag.decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
    expect(noTag.createContact).toHaveBeenCalledTimes(1)
    expect(noTag.saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(noTag.applyTag).not.toHaveBeenCalled()

    const authorized = await run(flags('true', 'true', 'true', 'true'))
    expect(authorized.decision).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
    expect(authorized.findByMember).toHaveBeenCalledTimes(1)
    expect(authorized.lookupIdentity).toHaveBeenCalledTimes(1)
    expect(authorized.createContact).toHaveBeenCalledTimes(1)
    expect(authorized.saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(authorized.applyTag).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(authorized.decision)).not.toContain('ext-created')
    expect(JSON.stringify(authorized.decision)).not.toContain(INPUT.email ?? '')
  })

  it('logs only the sanitized decision', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await runReportCardAgentCrmSync(INPUT, {
      syncEnabled: true,
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
    expect(config).toContain('home_buyer')
    expect(config).toContain('service-home-buyer-readiness')
    expect(config).toContain("assessmentType: 'protection'")
    expect(config).toContain('Protection Gap')
    expect(config).toContain('service-life-insurance')
    expect(config).not.toContain('Protection Report Card')
    expect(config).not.toContain('service-health-disability')
    expect(config).not.toContain('service-home-auto')
    expect(config).toContain("assessmentType: 'business'")
    expect(config).toContain('Business Report Card')
    expect(config).toContain('service-business-planning')
    expect(config).not.toContain('service-llc-setup')
    expect(config).not.toContain('service-tax-strategies')
    expect(config).not.toContain('service-payment-processing')
    expect(config).not.toContain('service-commercial-insurance')
    expect(config).not.toContain('service-employee-benefits')
    expect(config).toContain("assessmentType: 'family'")
    expect(config).toContain('Family Report Card')
    expect(config).not.toContain('Initial Financial Diagnostic')
    expect(config).toContain('service-family-planning')
    expect(config).toContain("assessmentType: 'retirement'")
    expect(config).toContain('Retirement Report Card')
    expect(config).toContain('service-retirement-planning')
    expect(config).not.toContain('service-annuities-retirement')
    expect(config).not.toContain('service-wills-trusts')
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
                    [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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
                        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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

  it('does nothing for an unknown assessment type', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const links = linked()
    for (const assessmentType of ['not_a_report_card']) {
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity,
          createContact,
          applyTag,
          links,
        }),
      )
      expect(decision).toBeNull()
    }
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(links.findByMember).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('creates, links, and tags a new Home Buyer person with the Home Buyer source and tag', async () => {
    const order: string[] = []
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'home_buyer' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async (input) => {
          order.push('create')
          expect(input.source).toBe('Home Buyer Report Card')
          return { id: 'ext-home-buyer', sourceMatched: true }
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
    expect(JSON.stringify(decision)).not.toContain('ext-home-buyer')
  })

  it('links an exact Home Buyer contact and does not update it', async () => {
    const createContact = vi.fn()
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'home_buyer' },
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

  it('tags an already linked Home Buyer person twice without searching or creating', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const links = linked()
    const first = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'home_buyer' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    const second = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'home_buyer' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links }),
    )
    expect(first).toEqual({ status: 'ALREADY_LINKED' })
    expect(second).toEqual({ status: 'ALREADY_LINKED' })
    expect(applyTag).toHaveBeenCalledTimes(2)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('adds the Home Buyer tag to a contact already linked from Student Loan or Credit', async () => {
    for (const prior of ['student_loan', 'credit'] as const) {
      const lookupIdentity = vi.fn()
      const createContact = vi.fn()
      const applyTag = vi.fn(async () => {})
      const student = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: prior },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          createContact: async () => ({ id: EXTERNAL_ID, sourceMatched: true }),
          applyTag,
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
        }),
      )
      const homeBuyer = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'home_buyer' },
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
      expect(student).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
      expect(homeBuyer).toEqual({ status: 'ALREADY_LINKED' })
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).toHaveBeenCalledTimes(2)
      expect(applyTag).toHaveBeenLastCalledWith(EXTERNAL_ID)
    }
  })

  it('keeps one contact and one link across Student Loan, Credit, and Home Buyer', async () => {
    let stored: string | null = null
    const createContact = vi.fn(async () => ({ id: EXTERNAL_ID, sourceMatched: true }))
    const applyTag = vi.fn(async () => {})
    const saveVerifiedLink = vi.fn(async () => {
      stored = EXTERNAL_ID
      return { status: 'created' as const }
    })
    const links = {
      findByMember: async () =>
        stored
          ? { status: 'found' as const, link: { householdMemberId: MEMBER_ID, externalContactId: stored } }
          : { status: 'not_found' as const },
      saveVerifiedLink,
    }
    const decisions = []
    for (const assessmentType of ['student_loan', 'credit', 'home_buyer'] as const) {
      decisions.push(
        await runReportCardAgentCrmSync(
          { ...INPUT, assessmentType },
          quiet({
            linkingEnabled: true,
            creationEnabled: true,
            taggingEnabled: true,
            lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
            createContact,
            applyTag,
            links,
          }),
        ),
      )
    }
    expect(decisions.map((decision) => decision?.status)).toEqual([
      'CREATED_AND_LINKED_CONTACT',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
    ])
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledTimes(3)
    expect(applyTag).toHaveBeenNthCalledWith(3, EXTERNAL_ID)
  })

  it('posts only the Home Buyer service tag and leaves Student Loan and Credit tags in place', async () => {
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
              source: 'Home Buyer Report Card',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          tags: ['service-student-loans', 'service-credit-improvement', 'service-home-buyer-readiness'],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'home_buyer' },
        {
          log: () => {},
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
          env: {
                        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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
      const tagBody = JSON.parse(String(tagInit.body)) as { tags: string[] }
      expect(JSON.parse(String(createInit.body))).toMatchObject({ source: 'Home Buyer Report Card' })
      expect(tagBody).toEqual({ tags: ['service-home-buyer-readiness'] })
      expect(tagBody.tags).not.toContain('service-home-auto')
      expect(tagBody.tags).not.toContain('service-credit-improvement')
      expect(JSON.stringify(createInit.body)).not.toMatch(/customFields|opportunity|workflow/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not sync a Protection possible match, missing member, or missing identity', async () => {
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
    const possible = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection', matchStatus: 'possible_match' },
      deps,
    )
    const replay = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'protection', memberId: null }, deps)
    const noEmail = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'protection', email: null }, deps)
    const noPhone = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'protection', phone: ' ' }, deps)
    expect(possible).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(replay).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
    expect(noEmail).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(noPhone).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(links.findByMember).not.toHaveBeenCalled()
  })

  it('does not create, link, or tag an ambiguous or failed Protection lookup', async () => {
    const lookupIdentity = vi.fn(async (): Promise<
      | { status: 'AMBIGUOUS'; reason: 'EMAIL_ONLY_MATCH' }
      | { status: 'INTEGRATION_ERROR'; category: 'timeout' }
    > => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }))
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const saveVerifiedLink = vi.fn()
    const ambiguous = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection' },
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
      { ...INPUT, assessmentType: 'protection' },
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
    expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('creates, links, and tags a new Protection person with the Protection Gap source', async () => {
    const order: string[] = []
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async (input) => {
          order.push('create')
          expect(input.source).toBe('Protection Gap')
          return { id: 'ext-protection', sourceMatched: true }
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
    expect(JSON.stringify(decision)).not.toContain('ext-protection')
  })

  it('links an exact Protection contact and does not update it', async () => {
    const createContact = vi.fn()
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection' },
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

  it('tags an already linked Protection person twice without searching or creating', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const links = linked()
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const first = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection' },
      quiet({ linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links, log: undefined }),
    )
    const second = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'protection' },
      { syncEnabled: true, linkingEnabled: true, creationEnabled: true, taggingEnabled: true, lookupIdentity, createContact, applyTag, links, locationId: 'loc-test' },
    )
    const logged = JSON.stringify(spy.mock.calls)
    spy.mockRestore()
    expect(first).toEqual({ status: 'ALREADY_LINKED' })
    expect(second).toEqual({ status: 'ALREADY_LINKED' })
    expect(applyTag).toHaveBeenCalledTimes(2)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
    expect(logged).toContain('protection')
    expect(logged).not.toContain(INPUT.email ?? '')
    expect(logged).not.toContain(INPUT.phone ?? '')
    expect(logged).not.toContain(EXTERNAL_ID)
  })

  it('adds the life-insurance tag to a contact already linked from another Report Card', async () => {
    for (const prior of ['student_loan', 'credit', 'home_buyer'] as const) {
      const lookupIdentity = vi.fn()
      const createContact = vi.fn()
      const applyTag = vi.fn(async () => {})
      const first = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: prior },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          createContact: async () => ({ id: EXTERNAL_ID, sourceMatched: true }),
          applyTag,
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
        }),
      )
      const protection = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'protection' },
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
      expect(first).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
      expect(protection).toEqual({ status: 'ALREADY_LINKED' })
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).toHaveBeenCalledTimes(2)
      expect(applyTag).toHaveBeenLastCalledWith(EXTERNAL_ID)
    }
  })

  it('keeps one contact and one link across Student Loan, Credit, Home Buyer, and Protection', async () => {
    let stored: string | null = null
    const createContact = vi.fn(async () => ({ id: EXTERNAL_ID, sourceMatched: true }))
    const applyTag = vi.fn(async () => {})
    const saveVerifiedLink = vi.fn(async () => {
      stored = EXTERNAL_ID
      return { status: 'created' as const }
    })
    const links = {
      findByMember: async () =>
        stored
          ? { status: 'found' as const, link: { householdMemberId: MEMBER_ID, externalContactId: stored } }
          : { status: 'not_found' as const },
      saveVerifiedLink,
    }
    const decisions = []
    for (const assessmentType of ['student_loan', 'credit', 'home_buyer', 'protection'] as const) {
      decisions.push(
        await runReportCardAgentCrmSync(
          { ...INPUT, assessmentType },
          quiet({
            linkingEnabled: true,
            creationEnabled: true,
            taggingEnabled: true,
            lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
            createContact,
            applyTag,
            links,
          }),
        ),
      )
    }
    expect(decisions.map((decision) => decision?.status)).toEqual([
      'CREATED_AND_LINKED_CONTACT',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
    ])
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledTimes(4)
    expect(applyTag).toHaveBeenNthCalledWith(4, EXTERNAL_ID)
  })

  it('posts only the life-insurance tag and leaves the other service tags in place', async () => {
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
              source: 'Protection Gap',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          tags: [
            'service-student-loans',
            'service-credit-improvement',
            'service-home-buyer-readiness',
            'service-life-insurance',
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'protection' },
        {
          log: () => {},
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
          env: {
                        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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
      const createBody = JSON.parse(String(createInit.body)) as Record<string, unknown>
      const tagBody = JSON.parse(String(tagInit.body)) as { tags: string[] }
      expect(createBody.source).toBe('Protection Gap')
      expect(createBody).not.toHaveProperty('tags')
      expect(tagBody).toEqual({ tags: ['service-life-insurance'] })
      expect(tagBody.tags).not.toContain('service-health-disability')
      expect(tagBody.tags).not.toContain('service-home-auto')
      expect(tagBody.tags).not.toContain('service-credit-improvement')
      expect(JSON.stringify(createInit.body)).not.toMatch(/customFields|opportunity|workflow/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  const BUSINESS_SPECIALIST_TAGS = [
    'service-llc-setup',
    'service-tax-strategies',
    'service-payment-processing',
    'service-commercial-insurance',
    'service-employee-benefits',
    'service-credit-improvement',
  ]

  it('does not sync a Business possible match, missing member, or missing identity', async () => {
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
    const possible = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business', matchStatus: 'possible_match' },
      deps,
    )
    const replay = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'business', memberId: null }, deps)
    const noEmail = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'business', email: null }, deps)
    const noPhone = await runReportCardAgentCrmSync({ ...INPUT, assessmentType: 'business', phone: ' ' }, deps)
    expect(possible).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(replay).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
    expect(noEmail).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(noPhone).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(links.findByMember).not.toHaveBeenCalled()
  })

  it('does not create, link, or tag an ambiguous or failed Business lookup', async () => {
    const lookupIdentity = vi.fn(async (): Promise<
      | { status: 'AMBIGUOUS'; reason: 'EMAIL_ONLY_MATCH' }
      | { status: 'INTEGRATION_ERROR'; category: 'timeout' }
    > => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }))
    const createContact = vi.fn()
    const applyTag = vi.fn()
    const saveVerifiedLink = vi.fn()
    const ambiguous = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business' },
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
      { ...INPUT, assessmentType: 'business' },
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
    expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
    expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
    expect(createContact).not.toHaveBeenCalled()
    expect(applyTag).not.toHaveBeenCalled()
    expect(saveVerifiedLink).not.toHaveBeenCalled()
  })

  it('creates, links, and tags a new Business person with the Business Report Card source', async () => {
    const order: string[] = []
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
        createContact: async (input) => {
          order.push('create')
          expect(input.source).toBe('Business Report Card')
          return { id: 'ext-business', sourceMatched: true }
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
    expect(JSON.stringify(decision)).not.toContain('ext-business')
  })

  it('links an exact Business contact and does not update it', async () => {
    const createContact = vi.fn()
    const decision = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business' },
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

  it('tags an already linked Business person twice without searching or creating', async () => {
    const lookupIdentity = vi.fn()
    const createContact = vi.fn()
    const applyTag = vi.fn(async () => {})
    const links = linked()
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const first = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business' },
      quiet({
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links,
        log: undefined,
      }),
    )
    const second = await runReportCardAgentCrmSync(
      { ...INPUT, assessmentType: 'business' },
      {
        syncEnabled: true,
        linkingEnabled: true,
        creationEnabled: true,
        taggingEnabled: true,
        lookupIdentity,
        createContact,
        applyTag,
        links,
        locationId: 'loc-test',
      },
    )
    const logged = JSON.stringify(spy.mock.calls)
    spy.mockRestore()
    expect(first).toEqual({ status: 'ALREADY_LINKED' })
    expect(second).toEqual({ status: 'ALREADY_LINKED' })
    expect(applyTag).toHaveBeenCalledTimes(2)
    expect(lookupIdentity).not.toHaveBeenCalled()
    expect(createContact).not.toHaveBeenCalled()
    expect(links.saveVerifiedLink).not.toHaveBeenCalled()
    expect(logged).toContain('business')
    expect(logged).not.toContain(INPUT.email ?? '')
    expect(logged).not.toContain(INPUT.phone ?? '')
    expect(logged).not.toContain(EXTERNAL_ID)
  })

  it('adds the business-planning tag to a contact already linked from Credit or Protection', async () => {
    for (const prior of ['credit', 'protection'] as const) {
      const lookupIdentity = vi.fn()
      const createContact = vi.fn()
      const applyTag = vi.fn(async () => {})
      const first = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: prior },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          createContact: async () => ({ id: EXTERNAL_ID, sourceMatched: true }),
          applyTag,
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
        }),
      )
      const business = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'business' },
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
      expect(first).toEqual({ status: 'CREATED_AND_LINKED_CONTACT' })
      expect(business).toEqual({ status: 'ALREADY_LINKED' })
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).toHaveBeenCalledTimes(2)
      expect(applyTag).toHaveBeenLastCalledWith(EXTERNAL_ID)
    }
  })

  it('keeps one contact and one link across all five enabled Report Cards', async () => {
    let stored: string | null = null
    const createContact = vi.fn(async () => ({ id: EXTERNAL_ID, sourceMatched: true }))
    const applyTag = vi.fn(async () => {})
    const saveVerifiedLink = vi.fn(async () => {
      stored = EXTERNAL_ID
      return { status: 'created' as const }
    })
    const links = {
      findByMember: async () =>
        stored
          ? { status: 'found' as const, link: { householdMemberId: MEMBER_ID, externalContactId: stored } }
          : { status: 'not_found' as const },
      saveVerifiedLink,
    }
    const decisions = []
    for (const assessmentType of ['student_loan', 'credit', 'home_buyer', 'protection', 'business'] as const) {
      decisions.push(
        await runReportCardAgentCrmSync(
          { ...INPUT, assessmentType },
          quiet({
            linkingEnabled: true,
            creationEnabled: true,
            taggingEnabled: true,
            lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
            createContact,
            applyTag,
            links,
          }),
        ),
      )
    }
    expect(decisions.map((decision) => decision?.status)).toEqual([
      'CREATED_AND_LINKED_CONTACT',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
    ])
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledTimes(5)
    expect(applyTag).toHaveBeenNthCalledWith(5, EXTERNAL_ID)
  })

  it('posts only the business-planning tag and leaves the other service tags in place', async () => {
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
              source: 'Business Report Card',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          tags: [
            'service-student-loans',
            'service-credit-improvement',
            'service-home-buyer-readiness',
            'service-life-insurance',
            'service-business-planning',
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: 'business' },
        {
          log: () => {},
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          links: {
            findByMember: async () => ({ status: 'not_found' as const }),
            saveVerifiedLink: async () => ({ status: 'created' as const }),
          },
          env: {
                        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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
      const createBody = JSON.parse(String(createInit.body)) as Record<string, unknown>
      const tagBody = JSON.parse(String(tagInit.body)) as { tags: string[] }
      expect(createBody.source).toBe('Business Report Card')
      expect(createBody).not.toHaveProperty('tags')
      expect(tagBody).toEqual({ tags: ['service-business-planning'] })
      for (const specialist of BUSINESS_SPECIALIST_TAGS) {
        expect(tagBody.tags).not.toContain(specialist)
      }
      expect(JSON.stringify(createInit.body)).not.toMatch(/customFields|opportunity|workflow/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  const NEUTRAL_CARDS = [
    {
      assessmentType: 'family',
      source: 'Family Report Card',
      tag: 'service-family-planning',
      forbidden: [
        'service-life-insurance',
        'service-wills-trusts',
        'service-annuities-retirement',
        'service-retirement-planning',
        'service-credit-improvement',
        'service-home-buyer-readiness',
      ],
    },
    {
      assessmentType: 'retirement',
      source: 'Retirement Report Card',
      tag: 'service-retirement-planning',
      forbidden: [
        'service-annuities-retirement',
        'service-tax-strategies',
        'service-wills-trusts',
        'service-health-disability',
        'service-life-insurance',
      ],
    },
  ] as const

  it('does not sync a Family or Retirement possible match, missing member, or missing identity', async () => {
    for (const card of NEUTRAL_CARDS) {
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
      const possible = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType, matchStatus: 'possible_match' },
        deps,
      )
      const replay = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType, memberId: null },
        deps,
      )
      const noEmail = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType, email: null },
        deps,
      )
      const noPhone = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType, phone: ' ' },
        deps,
      )
      expect(possible).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
      expect(replay).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
      expect(noEmail).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
      expect(noPhone).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).not.toHaveBeenCalled()
      expect(links.findByMember).not.toHaveBeenCalled()
    }
  })

  it('does not create, link, or tag an ambiguous or failed Family or Retirement lookup', async () => {
    for (const card of NEUTRAL_CARDS) {
      const lookupIdentity = vi.fn(async (): Promise<
        | { status: 'AMBIGUOUS'; reason: 'EMAIL_ONLY_MATCH' }
        | { status: 'INTEGRATION_ERROR'; category: 'timeout' }
      > => ({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' }))
      const createContact = vi.fn()
      const applyTag = vi.fn()
      const saveVerifiedLink = vi.fn()
      const ambiguous = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType },
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
        { ...INPUT, assessmentType: card.assessmentType },
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
      expect(ambiguous).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
      expect(failed).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
      expect(createContact).not.toHaveBeenCalled()
      expect(applyTag).not.toHaveBeenCalled()
      expect(saveVerifiedLink).not.toHaveBeenCalled()
    }
  })

  it('creates, links, and tags a new Family or Retirement person with that card source', async () => {
    for (const card of NEUTRAL_CARDS) {
      const order: string[] = []
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
          createContact: async (input) => {
            order.push('create')
            expect(input.source).toBe(card.source)
            return { id: `ext-${card.assessmentType}`, sourceMatched: true }
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
      expect(JSON.stringify(decision)).not.toContain(`ext-${card.assessmentType}`)
    }
  })

  it('links an exact Family or Retirement contact and does not update it', async () => {
    for (const card of NEUTRAL_CARDS) {
      const createContact = vi.fn()
      const decision = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType },
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
    }
  })

  it('tags an already linked Family or Retirement person twice without searching or creating', async () => {
    for (const card of NEUTRAL_CARDS) {
      const lookupIdentity = vi.fn()
      const createContact = vi.fn()
      const applyTag = vi.fn(async () => {})
      const links = linked()
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const first = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType },
        quiet({
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity,
          createContact,
          applyTag,
          links,
          log: undefined,
        }),
      )
      const second = await runReportCardAgentCrmSync(
        { ...INPUT, assessmentType: card.assessmentType },
        {
          syncEnabled: true,
          linkingEnabled: true,
          creationEnabled: true,
          taggingEnabled: true,
          lookupIdentity,
          createContact,
          applyTag,
          links,
          locationId: 'loc-test',
        },
      )
      const logged = JSON.stringify(spy.mock.calls)
      spy.mockRestore()
      expect(first).toEqual({ status: 'ALREADY_LINKED' })
      expect(second).toEqual({ status: 'ALREADY_LINKED' })
      expect(applyTag).toHaveBeenCalledTimes(2)
      expect(lookupIdentity).not.toHaveBeenCalled()
      expect(createContact).not.toHaveBeenCalled()
      expect(links.saveVerifiedLink).not.toHaveBeenCalled()
      expect(logged).toContain(card.assessmentType)
      expect(logged).not.toContain(INPUT.email ?? '')
      expect(logged).not.toContain(INPUT.phone ?? '')
      expect(logged).not.toContain(EXTERNAL_ID)
    }
  })

  it('keeps one contact and one link across all seven Report Cards', async () => {
    let stored: string | null = null
    const createContact = vi.fn(async () => ({ id: EXTERNAL_ID, sourceMatched: true }))
    const applyTag = vi.fn(async () => {})
    const saveVerifiedLink = vi.fn(async () => {
      stored = EXTERNAL_ID
      return { status: 'created' as const }
    })
    const links = {
      findByMember: async () =>
        stored
          ? { status: 'found' as const, link: { householdMemberId: MEMBER_ID, externalContactId: stored } }
          : { status: 'not_found' as const },
      saveVerifiedLink,
    }
    const sequence = ['student_loan', 'credit', 'home_buyer', 'protection', 'business', 'family', 'retirement'] as const
    const decisions = []
    for (const assessmentType of sequence) {
      decisions.push(
        await runReportCardAgentCrmSync(
          { ...INPUT, assessmentType },
          quiet({
            linkingEnabled: true,
            creationEnabled: true,
            taggingEnabled: true,
            lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
            createContact,
            applyTag,
            links,
          }),
        ),
      )
    }
    expect(decisions.map((decision) => decision?.status)).toEqual([
      'CREATED_AND_LINKED_CONTACT',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
      'ALREADY_LINKED',
    ])
    expect(createContact).toHaveBeenCalledTimes(1)
    expect(saveVerifiedLink).toHaveBeenCalledTimes(1)
    expect(applyTag).toHaveBeenCalledTimes(7)
    expect(applyTag).toHaveBeenNthCalledWith(7, EXTERNAL_ID)
  })

  it('posts only the neutral Family or Retirement tag', async () => {
    for (const card of NEUTRAL_CARDS) {
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
                source: card.source,
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            tags: [
              'service-student-loans',
              'service-credit-improvement',
              'service-home-buyer-readiness',
              'service-life-insurance',
              'service-business-planning',
              card.tag,
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      })
      vi.stubGlobal('fetch', fetchImpl)
      try {
        const decision = await runReportCardAgentCrmSync(
          { ...INPUT, assessmentType: card.assessmentType },
          {
            log: () => {},
            lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' as const }),
            links: {
              findByMember: async () => ({ status: 'not_found' as const }),
              saveVerifiedLink: async () => ({ status: 'created' as const }),
            },
            env: {
                            [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
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
        const createBody = JSON.parse(String(createInit.body)) as Record<string, unknown>
        const tagBody = JSON.parse(String(tagInit.body)) as { tags: string[] }
        expect(createBody.source).toBe(card.source)
        expect(createBody).not.toHaveProperty('tags')
        expect(tagBody).toEqual({ tags: [card.tag] })
        for (const specialist of card.forbidden) {
          expect(tagBody.tags).not.toContain(specialist)
        }
      } finally {
        vi.unstubAllGlobals()
      }
    }
  })
})
