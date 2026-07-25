import { describe, expect, it } from 'vitest'
import {
  formatDashboardError,
  isSectionEmpty,
  sectionErrorMessage,
  settleDashboardLoad,
} from './loadState'

describe('settleDashboardLoad', () => {
  it('marks successful loads as ok', async () => {
    const result = await settleDashboardLoad(Promise.resolve([1, 2]), [], 'tasks')
    expect(result).toEqual({ ok: true, value: [1, 2] })
  })

  it('captures errors and preserves fallback', async () => {
    const result = await settleDashboardLoad(
      Promise.reject({ message: 'boom', code: 'PGRST301' }),
      [] as number[],
      'tasks',
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.value).toEqual([])
    expect(result.error).toContain('tasks failed')
    expect(result.error).toContain('message=boom')
  })
})

describe('section helpers', () => {
  it('exposes user-facing section errors only for failed loads', () => {
    expect(sectionErrorMessage({ ok: true, value: [] })).toBeNull()
    expect(sectionErrorMessage({ ok: false, value: [], error: 'x' })).toBe(
      'Unable to load this section. Please try again.',
    )
  })

  it('detects empty successful sections', () => {
    expect(isSectionEmpty({ ok: true, value: [] }, false)).toBe(true)
    expect(isSectionEmpty({ ok: true, value: [1] }, false)).toBe(false)
    expect(isSectionEmpty({ ok: false, value: [], error: 'x' }, false)).toBe(false)
    expect(isSectionEmpty({ ok: true, value: [] }, true)).toBe(false)
  })

  it('formats unknown errors', () => {
    expect(formatDashboardError('metrics', null)).toContain('Unknown error')
  })
})
