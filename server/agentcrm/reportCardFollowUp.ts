import { assertAgentCrmServerOnly } from './config.js'
import { DeliveryHold, record } from './insurance/deliver.js'
import { getReportCardAgentCrmConfig } from './reportCardSyncConfig.js'

/** Contract for the documented v3 opportunity/task endpoints; no messaging methods. */
export type FollowUpTransport = {
  get(path: string, query?: Record<string, string | number>): Promise<unknown>
  post(path: string, body: Record<string, unknown>): Promise<unknown>
}
export type FollowUpDelivery = {
  lead_id: string
  contact_id: string
  opportunity_id: string | null
  opportunity_create_started: boolean
  task_id: string | null
  task_create_started: boolean
}
export type FollowUpTarget = {
  locationId: string
  pipelineId: string
  initialStageId: string
  assignedUserId: string
}
function providerId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(value)) throw new DeliveryHold('invalid_provider_id')
  return value
}
/**
 * Caller must supply a persisted claim, canonical identity verifier, stable due date,
 * verified routing configuration, and lease/consent-fenced checkpoint function.
 * Deliberately independent of tag changes: each lead owns its own task checkpoint.
 */
export async function deliverReportCardFollowUp(input: {
  delivery: FollowUpDelivery
  target: FollowUpTarget
  assessmentType: string
  dueDate: string
  transport: FollowUpTransport
  checkpoint(patch: Record<string, unknown>): Promise<void>
  verifyContact(): Promise<void>
}) {
  assertAgentCrmServerOnly()
  const { delivery: d, target: t, transport: api, checkpoint } = input
  if (typeof d.task_create_started !== 'boolean' || typeof d.opportunity_create_started !== 'boolean'
    || d.task_id === undefined || d.opportunity_id === undefined) throw new DeliveryHold('task_schema_unavailable')
  const card = getReportCardAgentCrmConfig(input.assessmentType)
  if (!card || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.lead_id)) throw new DeliveryHold('invalid_submission')
  const contactId = providerId(d.contact_id)
  providerId(t.locationId); providerId(t.pipelineId); providerId(t.assignedUserId)
  // Stage identifiers can be UUIDs in HighLevel.
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(t.initialStageId)) throw new DeliveryHold('invalid_stage')
  const dueTime = Date.parse(input.dueDate)
  if (!Number.isFinite(dueTime)) throw new DeliveryHold('invalid_due_date')
  const dueDate = new Date(dueTime).toISOString()
  const reference = `Valtoris submission ${d.lead_id}`
  const title = `Review ${card.source} — ${reference}`
  const body = `Review this consented ${card.source} submission in Valtoris CRM. ${reference}`
  const get = async (path: string, query?: Record<string, string | number>) => {
    await checkpoint({})
    return api.get(path, query)
  }
  const verifyIdentity = async () => { await checkpoint({}); await input.verifyContact() }
  await verifyIdentity()

  const opportunities = async () => {
    // Search all statuses so a completed opportunity is not silently duplicated/reopened.
    const response = record(await get('/opportunities/search', {
      locationId: t.locationId, pipelineId: t.pipelineId, contactId, status: 'all', limit: 100,
    }))
    if (!Array.isArray(response.opportunities)) throw new Error('invalid_opportunity_response')
    const rows = response.opportunities.map(record)
    const meta = record(response.meta)
    if (!Number.isInteger(meta.total) || Number(meta.total) < rows.length) throw new Error('incomplete_opportunity_response')
    if (Number(meta.total) > 1 || rows.length > 1 || meta.nextPage || meta.nextPageUrl) throw new DeliveryHold('multiple_opportunities')
    if (Number(meta.total) !== rows.length) throw new Error('incomplete_opportunity_response')
    for (const row of rows) {
      const rowContact = row.contactId ?? (row.contact ? record(row.contact).id : null)
      if (rowContact !== contactId || row.pipelineId !== t.pipelineId || (row.locationId !== undefined && row.locationId !== t.locationId)) throw new DeliveryHold('opportunity_scope_conflict')
      providerId(row.id)
    }
    return rows
  }
  let opportunityId = d.opportunity_id ? providerId(d.opportunity_id) : null
  const existing = await opportunities()
  if (existing.length) {
    const found = providerId(existing[0].id)
    if (opportunityId && opportunityId !== found) throw new DeliveryHold('opportunity_link_conflict')
    opportunityId = found
    await checkpoint({ opportunity_id: opportunityId })
  } else {
    if (opportunityId) throw new Error('opportunity_search_pending')
    if (d.opportunity_create_started) throw new DeliveryHold('opportunity_outcome_unknown')
    await verifyIdentity()
    await checkpoint({ opportunity_create_started: true })
    const response = record(await api.post('/opportunities/', {
      locationId: t.locationId, pipelineId: t.pipelineId, pipelineStageId: t.initialStageId,
      contactId, name: 'Valtoris Service Inquiry', status: 'open',
    }))
    opportunityId = providerId(record(response.opportunity).id)
    await checkpoint({ opportunity_id: opportunityId })
  }
  const verified = await opportunities()
  if (!verified.length) throw new Error('opportunity_search_pending')
  if (verified[0].id !== opportunityId) throw new DeliveryHold('opportunity_link_conflict')

  const taskPath = `/contacts/${contactId}/tasks`
  const verifyTask = (value: unknown, expectedId: string) => {
    const task = record(record(value).task)
    if (task.id !== expectedId || task.contactId !== contactId || task.title !== title || task.body !== body
      || task.assignedTo !== t.assignedUserId || typeof task.dueDate !== 'string'
      || Date.parse(task.dueDate) !== dueTime || typeof task.completed !== 'boolean') throw new DeliveryHold('task_verification_failed')
    // Preserve completion if Luis already handled the task before reconciliation.
  }
  let taskId = d.task_id ? providerId(d.task_id) : null
  if (!taskId) {
    const response = record(await get(taskPath))
    if (!Array.isArray(response.tasks)) throw new Error('invalid_task_response')
    const candidates = response.tasks.map(record).filter(task => task.title === title || (typeof task.body === 'string' && task.body.includes(reference)))
    if (candidates.length > 1) throw new DeliveryHold('multiple_submission_tasks')
    if (candidates.length) {
      if (!d.task_create_started) throw new DeliveryHold('untracked_submission_task')
      taskId = providerId(candidates[0].id)
      verifyTask({ task: candidates[0] }, taskId)
      await checkpoint({ task_id: taskId })
    } else {
      if (d.task_create_started) throw new DeliveryHold('task_outcome_unknown')
      await verifyIdentity()
      await checkpoint({ task_create_started: true })
      const response = record(await api.post(taskPath, { title, body, dueDate, completed: false, assignedTo: t.assignedUserId }))
      taskId = providerId(record(response.task).id)
      await checkpoint({ task_id: taskId })
    }
  }
  verifyTask(await get(`${taskPath}/${taskId}`), taskId)
  await checkpoint({ status: 'synced', last_code: 'verified' })
  return { opportunityId, taskId }
}
