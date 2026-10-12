import { describe, expect, it } from 'vitest'
import { createQuotePacketPdf, quotePacketFilename } from './insuranceQuotePdf'
import { quoteFixture } from '../../modules/insuranceQuote/fixtures'
import { insuranceQuoteSnapshot } from './insuranceQuoteSnapshot'
import { QUOTE_LABELS } from '../../modules/insuranceQuote/catalog'

function packet(kind: 'auto' | 'home' | 'commercial' = 'auto') {
  const source = quoteFixture(kind)
  return { quote: insuranceQuoteSnapshot(QUOTE_LABELS[kind], { quoteKind: kind, quoteAnswers: source.answers, ...source.contact })!, requestId: 'request-a', submittedAt: '2026-10-12T12:00:00Z' }
}
describe('Individual carrier quote packet', () => {
  it.each(['auto', 'home', 'commercial'] as const)('exports %s as a PDF with contact information and missing-answer flags', kind => {
    const input = packet(kind)
    const pdf = createQuotePacketPdf(input)
    const data = pdf.output()
    expect(data).toContain('%PDF-')
    expect(data).toContain('Synthetic QuoteTest')
    expect(data).toContain('Not provided - needs review')
    expect(data).toContain('request-a')
    expect(data).toContain('not a signed carrier application')
    expect(quotePacketFilename(input)).toMatch(new RegExp(`-${kind}-quote-request-a\\.pdf$`))
  })
  it('excludes unrelated answers and hidden coverage sections without treating blanks as no', () => {
    const input = packet('commercial')
    input.quote.answers.lines = ['General Liability']
    input.quote.answers.commercialDrivers = [{ name: 'Hidden sensitive driver' }]
    input.quote.answers.internalNote = 'Internal CRM note'
    input.quote.answers.claims = ''
    const text = createQuotePacketPdf(input).output()
    expect(text).not.toContain('Hidden sensitive driver')
    expect(text).not.toContain('Internal CRM note')
    expect(text).not.toContain('Workers')
    expect(text).toContain('Not provided - needs review')
  })
  it('paginates long answers and large schedules without losing their final rows', () => {
    const input = packet('commercial')
    input.quote.answers.lines = ['Workers’ Compensation']
    input.quote.answers.operations = 'LONG OPERATIONS '.repeat(1000) + 'OPERATIONS END'
    input.quote.answers.payrollClasses = Array.from({ length: 30 }, (_, i) => ({ duties: `Job ${i}`, employees: '0', payroll: '0' }))
    const pdf = createQuotePacketPdf(input)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(4)
    expect(pdf.output()).toContain('OPERATIONS END')
    expect(pdf.output()).toContain('Job 29')
    expect(pdf.output()).toContain(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`)
  })
  it('uses a safe individual filename without exposing email or phone', () => {
    const input = packet()
    input.quote.contact!.name = '../../Client/Name'
    const name = quotePacketFilename(input)
    expect(name).toBe('Client-Name-auto-quote-request-a.pdf')
    expect(name).not.toContain(input.quote.contact!.email)
  })
})
