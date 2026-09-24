import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { loadHouseholdInsuranceQuotes } from './insuranceQuotesApi'
import InsuranceQuoteDetail from '../intake/InsuranceQuoteDetail'
import { insuranceQuoteSnapshot } from '../intake/insuranceQuoteSnapshot'
import { quoteFixture } from '../../modules/insuranceQuote/fixtures'
import { QUOTE_LABELS, QUOTE_LEAD_TYPES } from '../../modules/insuranceQuote/catalog'

function mockClient(rows: unknown[], error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() }
  for (const fn of Object.values(query)) fn.mockReturnValue(query)
  query.range.mockResolvedValue({ data: rows, error })
  const from = vi.fn().mockReturnValue(query)
  return { client: { from } as unknown as SupabaseClient, from, query }
}

describe('Household quote history', () => {
  it('scopes private answers to the current household and excludes archived and non-quote leads', async () => {
    const { client, query } = mockClient([])
    await loadHouseholdInsuranceQuotes(client, 'household-a')
    expect(query.eq).toHaveBeenCalledWith('household_id', 'household-a')
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
    expect(query.in).toHaveBeenCalledWith('lead_type', [...QUOTE_LEAD_TYPES])
  })
  it('paginates history without silently dropping older submissions', async () => {
    const { client, query } = mockClient(Array.from({ length: 21 }, (_, id) => ({ id, lead_type: QUOTE_LEAD_TYPES[0], submitted_at: '2026-09-24' })))
    const result = await loadHouseholdInsuranceQuotes(client, 'household-a', 1)
    expect(query.range).toHaveBeenCalledWith(20, 40)
    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(20)
  })
  it('surfaces query failures instead of falsely showing no requests', async () => {
    const { client } = mockClient([], new Error('Access denied'))
    await expect(loadHouseholdInsuranceQuotes(client, 'household-a')).rejects.toThrow('Access denied')
  })
  it.each(['auto', 'home', 'commercial'] as const)('renders saved %s answers in the shared profile view', async kind => {
    const fixture = quoteFixture(kind)
    const { client } = mockClient([{ id: 'quote-1', lead_type: QUOTE_LABELS[kind], submitted_at: '2026-09-24', raw_payload: { quoteKind: kind, quoteAnswers: fixture.answers, ...fixture.contact } }])
    const result = await loadHouseholdInsuranceQuotes(client, 'household-a')
    const html = renderToStaticMarkup(createElement(InsuranceQuoteDetail, { quote: result.items[0].quote! }))
    expect(html).toContain('123 Test Street')
    if (kind === 'auto') { expect(html).toContain('Synthetic QuoteTest'); expect(html).toContain('Test Sedan') }
    if (kind === 'home') expect(html).toContain('Owner-occupied')
    if (kind === 'commercial') expect(html).toContain('Synthetic Test Business')
  })
  it('rejects non-quote payloads and renders saved quote details without allowing HTML', () => {
    expect(insuranceQuoteSnapshot('Other', { quoteKind: 'auto', quoteAnswers: {} })).toBeNull()
    const quote = insuranceQuoteSnapshot(QUOTE_LEAD_TYPES[0], { quoteKind: 'auto', quoteAnswers: {}, preferredContact: '<script>alert(1)</script>' })!
    const html = renderToStaticMarkup(createElement(InsuranceQuoteDetail, { quote }))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<details open="">')
  })
})
