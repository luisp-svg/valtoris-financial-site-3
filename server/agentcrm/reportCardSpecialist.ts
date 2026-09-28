import { assertAgentCrmServerOnly } from './config.js'
import { DeliveryHold } from './insurance/deliver.js'
import { STUDENT_LOAN_CONTACT_OWNER_ID } from './reportCardFollowUpConfig.js'

/** Direct student-loan ownership replaces reliance on adding a service tag. */
export async function assignReportCardSpecialist(input: {
  assessmentType: string
  contactId: string
  checkpoint(patch: Record<string, unknown>): Promise<void>
  readVerifiedOwner(): Promise<unknown>
  assignOwner(contactId: string, ownerId: string): Promise<unknown>
}) {
  assertAgentCrmServerOnly()
  if (input.assessmentType !== 'student_loan') return
  if (!/^[a-zA-Z0-9]{1,128}$/.test(input.contactId)) throw new DeliveryHold('invalid_contact_id')
  await input.checkpoint({})
  if (await input.readVerifiedOwner() === STUDENT_LOAN_CONTACT_OWNER_ID) return
  // Idempotent single-field assignment. Consent and the live lease fence each write.
  // A retry reads current ownership first; never send tags, source or consent fields.
  await input.checkpoint({})
  await input.assignOwner(input.contactId, STUDENT_LOAN_CONTACT_OWNER_ID)
  await input.checkpoint({})
  if (await input.readVerifiedOwner() !== STUDENT_LOAN_CONTACT_OWNER_ID) throw new DeliveryHold('contact_owner_verification_failed')
}
