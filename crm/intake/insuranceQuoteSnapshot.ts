import { isQuoteKind, isQuoteLead } from '../../modules/insuranceQuote/catalog'
import type { QuoteAnswers } from '../../modules/insuranceQuote/catalog'
import type { IntakeQueueItem } from './types'

export function insuranceQuoteSnapshot(leadType: unknown, payload: unknown): IntakeQueueItem['insuranceQuote'] {
  if (typeof leadType !== 'string' || !isQuoteLead(leadType) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const raw = payload as Record<string, unknown>
  if (!isQuoteKind(raw.quoteKind) || !raw.quoteAnswers || typeof raw.quoteAnswers !== 'object' || Array.isArray(raw.quoteAnswers)) return null
  return { kind: raw.quoteKind, answers: raw.quoteAnswers as QuoteAnswers, preferredContact: typeof raw.preferredContact === 'string' ? raw.preferredContact : null }
}
