import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { quoteFixture } from '../../modules/insuranceQuote/fixtures'
import { ingestQuote } from '../../server/ingest/insuranceQuote/ingest'
import { loadHouseholdInsuranceQuotes } from '../households/insuranceQuotesApi'
import { createQuotePacketPdf, quotePacketFilename } from './insuranceQuotePdf'
import { QUOTE_LABELS } from '../../modules/insuranceQuote/catalog'

describe('P&C public submission to individual PDF feed', () => {
  it.each(['auto', 'home', 'commercial'] as const)('preserves the selected client and %s answers through ingestion, CRM loading, and export', async kind => {
    const form = quoteFixture(kind)
    form.contact = { ...form.contact, firstName: 'Feed', lastName: 'Verification', email: 'feed-check@example.invalid', phone: '2025550123', preferredContact: 'Phone' }
    const rpc = vi.fn().mockResolvedValue({ data: { lead_id: 'selected-request', household_id: 'selected-client' }, error: null })
    const result = await ingestQuote(form, { admin: { rpc } as unknown as SupabaseClient, findCandidates: vi.fn().mockResolvedValue([]) })
    expect(result.status).toBe(200)
    const saved = rpc.mock.calls[0][1].p_payload
    expect(saved.kind).toBe(kind)
    expect(saved.consent_snapshot.sourcePage).toBe(`/${kind}-quote`)
    expect(saved.raw_payload.quoteAnswers).toEqual(form.answers)
    const rows = [{ id: 'selected-request', household_id: 'selected-client', lead_type: QUOTE_LABELS[kind], submitted_at: '2026-10-12T12:00:00Z', raw_payload: saved.raw_payload },
      { id: 'other-request', household_id: 'other-client', lead_type: QUOTE_LABELS[kind], submitted_at: '2026-10-12T12:00:00Z', raw_payload: { ...saved.raw_payload, firstName: 'Other', lastName: 'Private Client' } }]
    let household = ''
    const query = { select: vi.fn(), eq: vi.fn((_key: string, value: string) => { household = value; return query }), is: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn(async () => ({ data: rows.filter(row => row.household_id === household), error: null })) }
    for (const method of [query.select, query.is, query.in, query.order]) method.mockReturnValue(query)
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    const history = await loadHouseholdInsuranceQuotes(client, 'selected-client')
    expect(history.items).toHaveLength(1)
    const item = history.items[0]
    expect(item.quote?.contact).toEqual({ name: 'Feed Verification', email: 'feed-check@example.invalid', phone: '2025550123' })
    expect(item.quote?.preferredContact).toBe('Phone')
    expect(item.quote?.answers).toEqual(form.answers)
    const packet = { quote: item.quote!, requestId: item.id, submittedAt: item.submittedAt }
    const pdf = createQuotePacketPdf(packet).output()
    for (const text of ['Feed Verification', 'feed-check@example.invalid', '2025550123', 'Phone', 'selected-request', '123 Test Street']) expect(pdf).toContain(text)
    expect(pdf).not.toContain('Other Private Client')
    if (kind === 'auto') expect(pdf).toContain('Test Sedan')
    if (kind === 'home') expect(pdf).toContain('Owner-occupied')
    if (kind === 'commercial') expect(pdf).toContain('Synthetic Test Business')
    expect(quotePacketFilename(packet)).toContain(`${kind}-quote-selected-request.pdf`)
  })
})
