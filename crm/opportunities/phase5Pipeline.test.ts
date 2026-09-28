import { describe, expect, it } from 'vitest'
import { fetchPipelineOpportunities, normalizeOpportunityListItem, opportunityMatchesSearch } from './opportunitiesApi'
import { EMPTY_PIPELINE_FILTERS, filterPipelineScope, pipelineFilterOptions, pipelineStageSummary } from './pipelineFilters'
import { applyPipelineView, pipelineCardCopy } from './pipelineView'
import { normalizeUpdateOpportunityInput, validateUpdateOpportunityInput } from './opportunityValidation'

const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: 'Review', household_id: 'h', pipeline_id: 'p', stage_id: 's', service_vertical_id: 'v', assigned_advisor_id: 'a', status: 'open', updated_at: '2026-09-27T00:00:00Z', created_at: '2026-09-27T00:00:00Z', stage_entered_at: '2026-09-27T00:00:00Z', next_action: 'Call', next_action_due_at: '2026-09-30', ...extra })
function pagedClient(rows: Record<string, unknown>[], failPage = -1, cap = 100) {
  let page = 0
  const calls: (string | null)[] = []
  return { calls, client: { from: () => {
    let after: string | null = null
    const q = {
      select: () => q, is: () => q, order: () => q, limit: () => q,
      gt: (_key: string, value: string) => { after = value; return q },
      then: (resolve: (v: unknown) => unknown) => {
        calls.push(after)
        return Promise.resolve({ data: rows.filter(r => !after || String(r.id) > after).slice(0, cap), error: page++ === failPage ? new Error('Page failed') : null }).then(resolve)
      },
    }; return q
  } } }
}
describe('complete pipeline loading', () => {
  it('loads 205 rows including old deals and supports smaller server pages', async () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(String(i).padStart(4, '0')))
    const f = pagedClient(rows, -1, 40)
    const result = await fetchPipelineOpportunities(f.client as never)
    expect(result).toHaveLength(205)
    expect(new Set(result.map(r => r.id)).size).toBe(205)
    expect(f.calls).toEqual([null, '0039', '0079', '0119', '0159', '0199', '0204'])
  })
  it('rejects an incomplete load rather than returning partial counts', async () => {
    const f = pagedClient(Array.from({ length: 101 }, (_, i) => row(String(i).padStart(4, '0'))), 1)
    await expect(fetchPipelineOpportunities(f.client as never)).rejects.toThrow('Page failed')
  })
  it('handles an empty pipeline', async () => {
    const f = pagedClient([])
    expect(await fetchPipelineOpportunities(f.client as never)).toEqual([])
  })
})
describe('presentation and follow-up', () => {
  it('does not guess a product from the title or service', () => {
    expect(pipelineCardCopy(normalizeOpportunityListItem(row('1'))).primaryProduct).toBe('Not specified')
    const item = normalizeOpportunityListItem(row('1', { presented_product: 'Example IUL' }))
    expect(pipelineCardCopy(item).primaryProduct).toBe('Example IUL')
    expect(opportunityMatchesSearch(item, 'iul')).toBe(true)
  })
  it('validates, trims, clears, and preserves omitted products', () => {
    expect(validateUpdateOpportunityInput({ title: 'Review', presented_product: 'x'.repeat(201) }).ok).toBe(false)
    expect(normalizeUpdateOpportunityInput({ title: 'Review', presented_product: ' IUL ' }).presented_product).toBe('IUL')
    expect(normalizeUpdateOpportunityInput({ title: 'Review', presented_product: ' ' }).presented_product).toBeNull()
    expect(normalizeUpdateOpportunityInput({ title: 'Review' })).not.toHaveProperty('presented_product')
  })
  it('finds missing follow-up in recent active deals and excludes closed deals', () => {
    const items = [row('no-action', { next_action: ' ' }), row('no-date', { next_action_due_at: null }), row('won', { status: 'won', next_action: null, next_action_due_at: null }), row('healthy')].map(normalizeOpportunityListItem)
    expect(applyPipelineView(items, { view: 'attention', today: '2026-09-27' }).map(r => r.id)).toEqual(['no-action', 'no-date'])
  })
})
describe('pipeline filters and summaries', () => {
  const items = [row('1'), row('2', { assigned_advisor_id: null }), row('3', { stage_id: 's2', service_vertical_id: 'v2', assigned_advisor_id: 'b' })].map(normalizeOpportunityListItem)
  it('combines scope filters and supports unassigned', () => {
    expect(filterPipelineScope(items, { ...EMPTY_PIPELINE_FILTERS, serviceId: 'v', advisorId: 'unassigned' }).map(r => r.id)).toEqual(['2'])
    expect(filterPipelineScope(items, { stageId: 's2', serviceId: 'v', advisorId: '' })).toEqual([])
  })
  it('counts only supplied rows and keeps distinct stage identities', () => {
    expect(pipelineStageSummary(items).map(r => r.count)).toEqual([2, 1])
    expect(pipelineFilterOptions(items).advisors.map(r => r.id).sort()).toEqual(['a', 'b', 'unassigned'])
    expect(pipelineStageSummary(filterPipelineScope(items, { ...EMPTY_PIPELINE_FILTERS, advisorId: 'b' }))).toHaveLength(1)
  })
})
