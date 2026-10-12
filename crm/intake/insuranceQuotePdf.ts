import { jsPDF } from 'jspdf'
import { activeFields, activeSections, QUOTE_LABELS } from '../../modules/insuranceQuote/catalog'
import type { QuoteField } from '../../modules/insuranceQuote/catalog'
import type { IntakeQueueItem } from './types'

export type QuotePacket = {
  quote: NonNullable<IntakeQueueItem['insuranceQuote']>
  requestId: string
  submittedAt: string
  contact?: { name: string; email: string | null; phone: string | null }
}
const missing = 'Not provided - needs review'
const printable = (value: string) => value.replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
function answer(value: unknown): string {
  if (typeof value === 'string') return value.trim() || missing
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join(', ') || missing
  return missing
}
export function quotePacketFilename(packet: QuotePacket): string {
  const name = packet.quote.kind === 'commercial' ? answer(packet.quote.answers.businessName) : packet.contact?.name || packet.quote.contact?.name || 'Client'
  const safe = name.normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'Client'
  const id = packet.requestId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36) || 'request'
  return `${safe}-${packet.quote.kind}-quote-${id}.pdf`
}

/** Uses only the selected, already-authorized quote snapshot. No external requests or CRM writes. */
export function createQuotePacketPdf(packet: QuotePacket): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const left = 17, width = 182, bottom = 253
  let y = 39
  const contact = packet.contact ?? packet.quote.contact
  const header = () => {
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(23, 54, 75)
    doc.text('VALTORIS FINANCIAL', left, 17)
    doc.setFontSize(11).text(`${QUOTE_LABELS[packet.quote.kind]} - Quote Submission Summary`, left, 25)
    doc.setDrawColor(23, 54, 75).line(left, 30, left + width, 30)
  }
  const ensure = (height: number) => { if (y + height > bottom) { doc.addPage(); header(); y = 39 } }
  const lines = (text: string, size = 10, available = width): string[] => {
    doc.setFontSize(size)
    return doc.splitTextToSize(printable(text), available) as string[]
  }
  const paragraph = (text: string) => {
    doc.setFont('helvetica', 'normal').setTextColor(45, 45, 45)
    for (const line of lines(text)) { ensure(5); doc.text(line, left, y); y += 5 }
    y += 3
  }
  const section = (title: string) => {
    ensure(20)
    doc.setFillColor(233, 240, 244).rect(left, y - 4, width, 9, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(23, 54, 75).text(printable(title), left + 3, y + 2)
    y += 13
  }
  const field = (label: string, value: unknown) => {
    doc.setFont('helvetica', 'bold')
    const labels = lines(label, 9, 66)
    doc.setFont('helvetica', 'normal')
    const values = lines(answer(value), 10, 106)
    const count = Math.max(labels.length, values.length)
    // Keep ordinary label/value rows together; split only content taller than a page.
    if (count * 5 + 5 <= bottom - 39) ensure(count * 5 + 5)
    for (let offset = 0; offset < count;) {
      ensure(10)
      const fit = Math.max(1, Math.min(count - offset, Math.floor((bottom - y - 5) / 5)))
      const height = fit * 5 + 5
      doc.setDrawColor(210, 217, 223).rect(left, y - 3, width, height)
      doc.line(left + 72, y - 3, left + 72, y - 3 + height)
      doc.setTextColor(45, 45, 45)
      doc.setFont('helvetica', 'bold').setFontSize(9)
      labels.slice(offset, offset + fit).forEach((line, i) => doc.text(line, left + 3, y + 1 + i * 5))
      doc.setFont('helvetica', 'normal').setFontSize(10)
      values.slice(offset, offset + fit).forEach((line, i) => doc.text(line, left + 75, y + 1 + i * 5))
      y += height
      offset += fit
    }
    y += 2
  }
  header()
  paragraph('Prepared from client-submitted information for carrier quote review. Missing answers require follow-up. This summary is not a signed carrier application. No coverage is bound.')
  section('1. Applicant and request')
  field('Applicant / contact name', contact?.name)
  field('Email', contact?.email)
  field('Phone', contact?.phone)
  field('Preferred contact method', packet.quote.preferredContact)
  field('Request reference', packet.requestId)
  field('Submitted at', packet.submittedAt)
  field('Requested effective date', packet.quote.answers.effectiveDate)
  let number = 2
  for (const group of activeSections(packet.quote.kind, packet.quote.answers)) {
    section(`${number++}. ${group.title}`)
    for (const item of activeFields(group.fields, packet.quote.answers)) {
      const value = packet.quote.answers[item.id]
      if (item.type !== 'rows') { field(item.label, value); continue }
      const rows = Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[] : []
      if (!rows.length) { field(item.label, null); continue }
      rows.forEach((row, index) => {
        ensure(16)
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(23, 54, 75)
        doc.text(printable(`${item.label} - ${index + 1}`), left, y + 2); y += 9
        for (const child of activeFields(item.fields as QuoteField[], row as Record<string, string>)) field(child.label, row[child.id])
      })
    }
  }
  section(`${number}. Submission review`)
  paragraph('Review all answers with the applicant. Obtain the applicable carrier application, required signatures, and supporting documents before submission. Attachments are not included in this download.')
  if (packet.quote.kind === 'commercial') paragraph('Supporting documents to confirm with the carrier: current declarations, available loss runs, location and equipment schedules, and coverage-specific supplements.')
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page++) {
    doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(90, 90, 90)
    doc.text('Client-submitted information | Quote review', left, 265)
    doc.text(`Page ${page} of ${total}`, left + width, 265, { align: 'right' })
  }
  doc.setProperties({ title: QUOTE_LABELS[packet.quote.kind], author: 'Valtoris Financial', subject: 'Individual client quote submission summary' })
  return doc
}
