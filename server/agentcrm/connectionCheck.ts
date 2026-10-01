import { LeadConnectorClient } from './client.js'
import { readAgentCrmConfig } from './config.js'
import { LeadConnectorError } from './errors.js'
import { ReportCardFollowUpClient } from './reportCardFollowUpClient.js'
import { REPORT_CARD_FOLLOW_UP_TARGET } from './reportCardFollowUpConfig.js'

type OpportunitySummary = { returned: number; total: number | null; uniqueIds: number; matchingContact: number; matchingPipeline: number; nextPagePresent: boolean; nextPageUrlPresent: boolean }
type Check = { status: 'PASS' | 'FAIL' | 'NOT_RUN'; reason?: string; summary?: OpportunitySummary }
type CheckName = 'location' | 'contacts' | 'pipeline' | 'opportunities' | 'tasks' | 'contactOpportunities'
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const invalid = () => { throw new LeadConnectorError('invalid_response') }

/** Owner-only caller. GET requests only; never return provider records or secret values. */
export async function checkAgentCrmConnection(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const checks: Record<CheckName, Check> = {
    location: { status: 'NOT_RUN' }, contacts: { status: 'NOT_RUN' },
    pipeline: { status: 'NOT_RUN' }, opportunities: { status: 'NOT_RUN' }, tasks: { status: 'NOT_RUN' }, contactOpportunities: { status: 'NOT_RUN' },
  }
  const result = () => ({
    ok: Object.values(checks).every(check => check.status === 'PASS'),
    mode: 'read_only' as const, checks, writeAccess: 'not_tested' as const,
  })
  let config
  try { config = readAgentCrmConfig(env) } catch {
    checks.location = { status: 'FAIL', reason: 'invalid_configuration' }; return result()
  }
  if (!config.configured) {
    checks.location = { status: 'FAIL', reason: 'missing_configuration' }; return result()
  }
  const target = REPORT_CARD_FOLLOW_UP_TARGET
  if (config.locationId !== target.locationId) {
    checks.location = { status: 'FAIL', reason: 'location_mismatch' }; return result()
  }
  const readOnlyFetch: typeof fetch = (input, init) => {
    if (init?.method !== 'GET') throw new LeadConnectorError('invalid_response')
    return fetchImpl(input, { ...init, redirect: 'error' })
  }
  const client = new LeadConnectorClient({ token: config.token, fetchImpl: readOnlyFetch })
  const followUp = new ReportCardFollowUpClient(config.token, readOnlyFetch)
  const check = async (name: CheckName, read: () => Promise<void>) => {
    try { await read(); checks[name] = { status: 'PASS' } }
    catch (error) {
      checks[name] = { status: 'FAIL', reason: error instanceof LeadConnectorError ? error.category : 'request_failed' }
    }
  }
  await check('location', async () => {
    const payload = object(await client.get(`/locations/${target.locationId}`))
    if (object(payload.location).id !== target.locationId) invalid()
  })
  if (checks.location.status !== 'PASS') return result()

  let contactId: string | null = null
  await Promise.all([
    check('contacts', async () => {
      const payload = object(await client.get('/contacts/', { locationId: target.locationId, limit: 1 }))
      if (!Array.isArray(payload.contacts) || payload.contacts.length > 1) return invalid()
      if (!payload.contacts.length) return
      const contact = object(payload.contacts[0])
      if (typeof contact.id !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(contact.id)
        || contact.locationId !== target.locationId) return invalid()
      contactId = contact.id
    }),
    check('pipeline', async () => {
      const payload = object(await client.get('/opportunities/pipelines', { locationId: target.locationId }))
      if (!Array.isArray(payload.pipelines)) return invalid()
      const pipeline = payload.pipelines.map(object).find(p => p.id === target.pipelineId)
      if (!pipeline || !Array.isArray(pipeline.stages)
        || !pipeline.stages.some(stage => object(stage).id === target.initialStageId)) invalid()
    }),
    check('opportunities', async () => {
      const payload = object(await followUp.get('/opportunities/search', {
        locationId: target.locationId, pipelineId: target.pipelineId, status: 'all', limit: 1,
      }))
      if (!Array.isArray(payload.opportunities) || payload.opportunities.length > 1) return invalid()
      for (const value of payload.opportunities) {
        const row = object(value)
        if (row.pipelineId !== target.pipelineId || (row.locationId !== undefined && row.locationId !== target.locationId)) invalid()
      }
    }),
  ])
  if (contactId) {
    const verifiedContactId = contactId
    let summary: OpportunitySummary | undefined
    await check('contactOpportunities', async () => {
      const payload = object(await followUp.get('/opportunities/search', {
        locationId: target.locationId, pipelineId: target.pipelineId,
        contactId: verifiedContactId, status: 'all', limit: 100, page: 1,
      }))
      if (!Array.isArray(payload.opportunities) || payload.opportunities.length > 100) return invalid()
      const rows = payload.opportunities.map(object)
      if (rows.some(row => typeof row.id !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(row.id))) return invalid()
      const total = object(payload.meta).total
      summary = {
        returned: rows.length, total: typeof total === 'number' && Number.isSafeInteger(total) && total >= 0 ? total : null,
        nextPagePresent: Boolean(object(payload.meta).nextPage), nextPageUrlPresent: Boolean(object(payload.meta).nextPageUrl),
        uniqueIds: new Set(rows.map(row => row.id)).size,
        matchingContact: rows.filter(row => (row.contactId ?? object(row.contact).id) === verifiedContactId).length,
        matchingPipeline: rows.filter(row => row.pipelineId === target.pipelineId).length,
      }
    })
    if (summary) checks.contactOpportunities.summary = summary
    await check('tasks', async () => {
      const payload = object(await followUp.get(`/contacts/${contactId}/tasks`))
      if (!Array.isArray(payload.tasks)) invalid()
    })
  } else {
    checks.contactOpportunities = { status: 'NOT_RUN', reason: 'no_verified_contact' }
    checks.tasks = { status: 'NOT_RUN', reason: checks.contacts.status === 'PASS' ? 'no_existing_contact' : 'contact_check_failed' }
  }
  return result()
}
