import type { QuoteKind } from '../../../modules/insuranceQuote/catalog.js'
/** Preparation only. External custom field IDs/workflow IDs must be verified before activation. */
export function prepareQuoteAgentCrmHandoff(input: {
  submissionId: string; kind: QuoteKind; firstName: string; lastName: string; email: string; phone: string;
  preferredContact: string; consentVersion: string; consentedAt: string;
  contactPermission: boolean; matchResolved: boolean; assignedAdvisorId: string | null;
}) {
  if (!input.contactPermission || !input.matchResolved) return { status: 'held_for_review' as const }
  return { status: 'prepared_not_sent' as const, automaticMessagingEnabled: false,
    contact: { firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone },
    fields: { valtorisSubmissionId: input.submissionId, quoteType: input.kind, source: `Valtoris /${input.kind}-quote`, quoteStage: 'Quote Requested', assignedAdvisorId: input.assignedAdvisorId, preferredContact: input.preferredContact, consentVersion: input.consentVersion, consentedAt: input.consentedAt, emailMarketingConsent: false, smsMarketingConsent: false },
  }
}
