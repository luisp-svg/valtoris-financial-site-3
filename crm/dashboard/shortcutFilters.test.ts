import { describe, expect, it } from 'vitest'
import { closedMonthFromParams, filterClosedMonth } from './shortcutFilters'
import { writePipelineViewSearchParams } from '../opportunities/pipelineView'

describe('dashboard closed-month drill-down', () => {
  it('rejects malformed months instead of constructing invalid dates', () => {
    for (const value of ['', '2026-00', '2026-13', '2026-1', 'bad']) {
      expect(closedMonthFromParams(new URLSearchParams({ closedMonth: value }))).toBeNull()
    }
    expect(closedMonthFromParams(new URLSearchParams('closedMonth=2026-11'))).toBe('2026-11')
  })
  it('uses inclusive/exclusive Chicago month boundaries across the November DST change', () => {
    const rows = [
      { id: 'before', closed_at: '2026-11-01T04:59:59Z' },
      { id: 'start', closed_at: '2026-11-01T05:00:00Z' },
      { id: 'last', closed_at: '2026-12-01T05:59:59Z' },
      { id: 'end', closed_at: '2026-12-01T06:00:00Z' },
      { id: 'reopened', closed_at: null },
      { id: 'invalid', closed_at: 'invalid' },
    ]
    expect(filterClosedMonth(rows, '2026-11').map(row => row.id)).toEqual(['start', 'last'])
    expect(filterClosedMonth(rows, null)).toHaveLength(6)
  })
  it('retains the period when switching won/lost and clears it for active views', () => {
    const params = new URLSearchParams('status=won&closedMonth=2026-12&other=keep')
    expect(writePipelineViewSearchParams(params, 'lost').get('closedMonth')).toBe('2026-12')
    const active = writePipelineViewSearchParams(params, 'active')
    expect(active.has('closedMonth')).toBe(false)
    expect(active.get('other')).toBe('keep')
  })
})
