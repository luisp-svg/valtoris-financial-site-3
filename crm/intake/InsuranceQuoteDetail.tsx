import { useState } from 'react'
import type { QuotePacket } from './insuranceQuotePdf'
import { activeFields, activeSections, QUOTE_LABELS } from '../../modules/insuranceQuote/catalog'
import type { IntakeQueueItem } from './types'
export default function InsuranceQuoteDetail({ quote, packet }: { quote: NonNullable<IntakeQueueItem['insuranceQuote']>; packet?: Omit<QuotePacket, 'quote'> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function download() {
    if (!packet) return
    setBusy(true); setError(false)
    try {
      const { createQuotePacketPdf, quotePacketFilename } = await import('./insuranceQuotePdf')
      const selected = { ...packet, quote }
      createQuotePacketPdf(selected).save(quotePacketFilename(selected))
    } catch { setError(true) } finally { setBusy(false) }
  }
  return <section className="crm-intake-detail-section"><h3>{QUOTE_LABELS[quote.kind]}</h3><p className="crm-muted">Quote requested · Self-reported information for advisor review. No coverage is bound.</p>{packet ? <div><button type="button" className="platform-btn platform-btn-outline" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing PDF…' : 'Download P&C Quote Packet'}</button><p className="crm-muted">Downloads this request only. Review missing answers before sending to a carrier.</p>{error ? <p role="alert">Unable to prepare the PDF. Please try again.</p> : null}</div> : null}<p>Preferred contact: {quote.preferredContact ?? 'Not provided'}</p>
    {activeSections(quote.kind, quote.answers).map(section => <details key={section.id} open><summary>{section.title}</summary><dl className="crm-intake-dl">{activeFields(section.fields, quote.answers).map(field => {
      const value = quote.answers[field.id]
      return <div key={field.id}><dt>{field.label}</dt><dd>{Array.isArray(value) && field.type === 'rows' ? (value as Record<string, string>[]).map((row, index) => <div key={index}>{field.fields!.map(child => row[child.id] ? <p key={child.id}>{child.label}: {row[child.id]}</p> : null)}</div>) : Array.isArray(value) ? value.join(', ') : value || 'Not provided'}</dd></div>
    })}</dl></details>)}
  </section>
}
