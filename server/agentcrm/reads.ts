import type { LeadConnectorClient } from './client.js'
import { LeadConnectorError } from './errors.js'

export type LocationSummary = {
  id: string
  name: string
}

export type NamedRecord = {
  id: string
  name: string
}

export type CustomFieldSummary = {
  id: string
  name: string
  fieldKey: string | null
  dataType: string | null
  model: string | null
}

export type PipelineSummary = {
  id: string
  name: string
  stages: NamedRecord[]
}

export type ContactReadSummary = {
  returned: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readId(record: Record<string, unknown>): string | null {
  return readString(record.id) ?? readString(record._id)
}

function readName(record: Record<string, unknown>): string | null {
  return readString(record.name) ?? readString(record.businessName) ?? readString(record.title)
}

function namedFromUnknown(value: unknown): NamedRecord | null {
  const record = asRecord(value)
  if (!record) return null
  const id = readId(record)
  const name = readName(record)
  if (!id || !name) return null
  return { id, name }
}

function listFromPayload(payload: unknown, keys: readonly string[]): unknown[] {
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  if (!record) return []
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export async function readLocation(
  client: LeadConnectorClient,
  locationId: string,
): Promise<LocationSummary> {
  const payload = await client.get(`/locations/${encodeURIComponent(locationId)}`)
  const root = asRecord(payload)
  const location = asRecord(root?.location) ?? root
  if (!location) throw new LeadConnectorError('invalid_response', null)
  const id = readId(location) ?? locationId
  const name = readName(location)
  if (!name) throw new LeadConnectorError('invalid_response', null)
  return { id, name }
}

/**
 * Smallest documented contact read: GET /contacts/?locationId=&limit=1.
 * The response records are counted and discarded. Names, emails, and phones
 * are not returned.
 */
export async function readContactCount(
  client: LeadConnectorClient,
  locationId: string,
): Promise<ContactReadSummary> {
  const payload = await client.get('/contacts/', { locationId, limit: 1 })
  const contacts = listFromPayload(payload, ['contacts'])
  return { returned: contacts.length }
}

export async function readCustomFields(
  client: LeadConnectorClient,
  locationId: string,
): Promise<CustomFieldSummary[]> {
  const payload = await client.get(`/locations/${encodeURIComponent(locationId)}/customFields`)
  return listFromPayload(payload, ['customFields', 'customField']).flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = readId(record)
    const name = readName(record)
    if (!id || !name) return []
    return [
      {
        id,
        name,
        fieldKey: readString(record.fieldKey),
        dataType: readString(record.dataType),
        model: readString(record.model),
      },
    ]
  })
}

export async function readTags(
  client: LeadConnectorClient,
  locationId: string,
): Promise<NamedRecord[]> {
  const payload = await client.get(`/locations/${encodeURIComponent(locationId)}/tags`)
  return listFromPayload(payload, ['tags'])
    .map(namedFromUnknown)
    .filter((item): item is NamedRecord => item != null)
}

export async function readPipelines(
  client: LeadConnectorClient,
  locationId: string,
): Promise<PipelineSummary[]> {
  const payload = await client.get('/opportunities/pipelines', { locationId })
  return listFromPayload(payload, ['pipelines']).flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = readId(record)
    const name = readName(record)
    if (!id || !name) return []
    const stages = listFromPayload(record.stages, ['stages'])
      .map(namedFromUnknown)
      .filter((stage): stage is NamedRecord => stage != null)
    return [{ id, name, stages }]
  })
}

export async function readCalendars(
  client: LeadConnectorClient,
  locationId: string,
): Promise<NamedRecord[]> {
  const payload = await client.get('/calendars/', { locationId })
  return listFromPayload(payload, ['calendars'])
    .map(namedFromUnknown)
    .filter((item): item is NamedRecord => item != null)
}

export async function readWorkflows(
  client: LeadConnectorClient,
  locationId: string,
): Promise<NamedRecord[]> {
  const payload = await client.get('/workflows/', { locationId })
  return listFromPayload(payload, ['workflows'])
    .map(namedFromUnknown)
    .filter((item): item is NamedRecord => item != null)
}
