import { assertAgentCrmServerOnly } from './config.js'
import { DeliveryHold } from './insurance/deliver.js'

/** Verified in AgentCRM UI; New Inquiry selected by Luis on 2026-09-28. */
export const REPORT_CARD_FOLLOW_UP_TARGET = {
  locationId: 'I2Y36c45rBLFZhCQwkDC',
  pipelineId: 'PsDkzCwY1xpySYvqd4j0',
  initialStageId: '4160668d-8563-48bc-bc2f-533d6df3fc14',
  assignedUserId: 'GZ4Vq6MpSwMfhabIAne3',
} as const

// Lizbeth's account ID verified in My Staff; direct student-loan assignment approved.
export const STUDENT_LOAN_CONTACT_OWNER_ID = 'jHigWJV8e0wu5VidwMTx'

/** Verified in AgentCRM Users; service ownership requested by Luis on 2026-10-17. */
export const HEALTH_CONTACT_OWNER_ID = 'gxrvJMHczw375SQveVHi'

export function reportCardContactOwner(assessmentType: string): string | null {
  if (assessmentType === 'health') return HEALTH_CONTACT_OWNER_ID
  if (assessmentType === 'tsp') return REPORT_CARD_FOLLOW_UP_TARGET.assignedUserId
  if (assessmentType === 'student_loan') return STUDENT_LOAN_CONTACT_OWNER_ID
  return null
}

/** Route Health follow-up to Jazmin; retain existing task ownership for other services. */
export function reportCardFollowUpTarget(assessmentType: string) {
  return { ...REPORT_CARD_FOLLOW_UP_TARGET,
    assignedUserId: assessmentType === 'health' ? HEALTH_CONTACT_OWNER_ID : REPORT_CARD_FOLLOW_UP_TARGET.assignedUserId,
  }
}

export function reportCardFollowUpReady(env: NodeJS.ProcessEnv, locationId: string): boolean {
  assertAgentCrmServerOnly()
  // The second attestation covers direct opportunity/task and contact-owner triggers.
  return locationId === REPORT_CARD_FOLLOW_UP_TARGET.locationId
    && env.AGENTCRM_REPORT_CARD_TRIGGERS_VERIFIED === 'true'
    && env.AGENTCRM_REPORT_CARD_DIRECT_FOLLOW_UP_VERIFIED === 'true'
}

/** Next weekday at 9am Central, anchored to the persisted submission time, not retry time. */
export function reportCardTaskDueDate(createdAt: unknown): string {
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new DeliveryHold('invalid_submission_date')
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const parts = (date: Date) => Object.fromEntries(format.formatToParts(date).map(p => [p.type, p.value]))
  const local = parts(new Date(createdAt))
  const day = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day) + 1, 9))
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1)
  const desired = day.getTime()
  let instant = desired
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(instant))
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    instant += desired - represented
  }
  return new Date(instant).toISOString()
}
