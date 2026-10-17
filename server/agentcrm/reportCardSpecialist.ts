import { assertAgentCrmServerOnly } from './config.js'
import { DeliveryHold } from './insurance/deliver.js'
import { reportCardContactOwner } from './reportCardFollowUpConfig.js'

/** Direct specialist ownership avoids firing tag-based routing workflows. */
export async function assignReportCardSpecialist(input: {
  assessmentType: string
  contactId: string
  checkpoint(patch: Record<string, unknown>): Promise<void>
  readVerifiedOwner(): Promise<unknown>
  assignOwner(contactId: string, ownerId: string): Promise<unknown>
}) {
  assertAgentCrmServerOnly()
  const ownerId = reportCardContactOwner(input.assessmentType)
  if (!ownerId) return
  if (!/^[a-zA-Z0-9]{1,128}$/.test(input.contactId)) throw new DeliveryHold('invalid_contact_id')
  await input.checkpoint({})
  if (await input.readVerifiedOwner() === ownerId) return
  // Idempotent single-field assignment. Consent and the live lease fence each write.
  // A retry reads current ownership first; never send tags, source or consent fields.
  await input.checkpoint({})
  await input.assignOwner(input.contactId, ownerId)
  await input.checkpoint({})
  if (await input.readVerifiedOwner() !== ownerId) throw new DeliveryHold('contact_owner_verification_failed')
}
