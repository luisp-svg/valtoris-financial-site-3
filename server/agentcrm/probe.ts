import { LeadConnectorClient } from './client.js'
import { readAgentCrmConfig, type AgentCrmMissingSetting } from './config.js'
import { LeadConnectorError } from './errors.js'
import {
  readCalendars,
  readContactCount,
  readCustomFields,
  readLocation,
  readPipelines,
  readTags,
  readWorkflows,
  type CustomFieldSummary,
  type LocationSummary,
  type NamedRecord,
  type PipelineSummary,
} from './reads.js'

export type ProbeStatus = 'PASS' | 'FAIL' | 'NOT_RUN'

export type ProbeFailure = {
  step: string
  category: string
  status: number | null
}

export type AgentCrmProbeReport = {
  authentication: ProbeStatus
  locationLookup: ProbeStatus
  contactRead: ProbeStatus
  metadataDiscovery: ProbeStatus
  contactsReturned: number | null
  location: LocationSummary | null
  customFields: CustomFieldSummary[]
  tags: NamedRecord[]
  pipelines: PipelineSummary[]
  calendars: NamedRecord[]
  workflows: NamedRecord[]
  unavailable: string[]
  failures: ProbeFailure[]
}

export type ConfiguredProbeResult =
  | { configured: false; missing: AgentCrmMissingSetting[] }
  | { configured: true; report: AgentCrmProbeReport }

function emptyReport(): AgentCrmProbeReport {
  return {
    authentication: 'NOT_RUN',
    locationLookup: 'NOT_RUN',
    contactRead: 'NOT_RUN',
    metadataDiscovery: 'NOT_RUN',
    contactsReturned: null,
    location: null,
    customFields: [],
    tags: [],
    pipelines: [],
    calendars: [],
    workflows: [],
    unavailable: [],
    failures: [],
  }
}

function failureFrom(step: string, error: unknown): ProbeFailure {
  if (error instanceof LeadConnectorError) {
    return { step, category: error.category, status: error.status }
  }
  return { step, category: 'network', status: null }
}

async function readMetadataStep<T>(
  step: string,
  report: AgentCrmProbeReport,
  read: () => Promise<T>,
  apply: (value: T) => void,
): Promise<boolean> {
  try {
    apply(await read())
    return true
  } catch (error) {
    const failure = failureFrom(step, error)
    if (failure.category === 'not_found' || failure.category === 'forbidden') {
      report.unavailable.push(step)
      return false
    }
    report.failures.push(failure)
    return false
  }
}

/**
 * Read-only connectivity and metadata probe.
 * Uses GET requests only. Contact payloads are reduced to a count.
 */
export async function probeAgentCrm(
  client: LeadConnectorClient,
  locationId: string,
): Promise<AgentCrmProbeReport> {
  const report = emptyReport()

  try {
    report.location = await readLocation(client, locationId)
    report.authentication = 'PASS'
    report.locationLookup = 'PASS'
  } catch (error) {
    const failure = failureFrom('location', error)
    report.failures.push(failure)
    report.locationLookup = 'FAIL'
    report.authentication =
      failure.category === 'forbidden' || failure.category === 'not_found' ? 'PASS' : 'FAIL'
    report.contactRead = 'NOT_RUN'
    report.metadataDiscovery = 'NOT_RUN'
    return report
  }

  try {
    const contacts = await readContactCount(client, locationId)
    report.contactsReturned = contacts.returned
    report.contactRead = 'PASS'
  } catch (error) {
    report.failures.push(failureFrom('contacts', error))
    report.contactRead = 'FAIL'
  }

  const metadataResults = await Promise.all([
    readMetadataStep('customFields', report, () => readCustomFields(client, locationId), (value) => {
      report.customFields = value
    }),
    readMetadataStep('tags', report, () => readTags(client, locationId), (value) => {
      report.tags = value
    }),
    readMetadataStep('pipelines', report, () => readPipelines(client, locationId), (value) => {
      report.pipelines = value
    }),
    readMetadataStep('calendars', report, () => readCalendars(client, locationId), (value) => {
      report.calendars = value
    }),
    readMetadataStep('workflows', report, () => readWorkflows(client, locationId), (value) => {
      report.workflows = value
    }),
  ])

  report.metadataDiscovery = metadataResults.some(Boolean) ? 'PASS' : 'FAIL'
  return report
}

export async function runConfiguredAgentCrmProbe(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): Promise<ConfiguredProbeResult> {
  const config = readAgentCrmConfig(env)
  if (!config.configured) return { configured: false, missing: config.missing }
  const client = new LeadConnectorClient({ token: config.token, fetchImpl })
  return { configured: true, report: await probeAgentCrm(client, config.locationId) }
}
