import { activeFields, activeSections, QUOTE_LABELS } from '../../modules/insuranceQuote/catalog'
import type { IntakeQueueItem } from './types'
export default function InsuranceQuoteDetail({ quote }: { quote: NonNullable<IntakeQueueItem['insuranceQuote']> }) {
  return <section className="crm-intake-detail-section"><h3>{QUOTE_LABELS[quote.kind]}</h3><p className="crm-muted">Quote requested · Self-reported information for advisor review. No coverage is bound.</p><p>Preferred contact: {quote.preferredContact ?? 'Not provided'}</p>
    {activeSections(quote.kind, quote.answers).map(section => <details key={section.id} open><summary>{section.title}</summary><dl className="crm-intake-dl">{activeFields(section.fields, quote.answers).map(field => {
      const value = quote.answers[field.id]
      return <div key={field.id}><dt>{field.label}</dt><dd>{Array.isArray(value) && field.type === 'rows' ? (value as Record<string, string>[]).map((row, index) => <div key={index}>{field.fields!.map(child => row[child.id] ? <p key={child.id}>{child.label}: {row[child.id]}</p> : null)}</div>) : Array.isArray(value) ? value.join(', ') : value || 'Not provided'}</dd></div>
    })}</dl></details>)}
  </section>
}
