import { describe, expect, it } from 'vitest'
import {
  calendarDateInPeriod,
  calendarDateOnly,
  dashboardPeriodBounds,
  DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  DEFAULT_PRODUCTION_DASHBOARD_PERIOD,
} from './dashboardPeriod'

describe('dashboard reporting periods', () => {
  it('defaults production to Lifetime and compensation to This Month', () => {
    expect(DEFAULT_PRODUCTION_DASHBOARD_PERIOD).toBe('lifetime')
    expect(DEFAULT_COMPENSATION_DASHBOARD_PERIOD).toBe('this_month')
  })

  it('uses local calendar year and month bounds without UTC shifting', () => {
    expect(dashboardPeriodBounds('lifetime', '2026-03-15')).toEqual({ from: null, to: '2026-03-15' })
    expect(dashboardPeriodBounds('ytd', '2026-03-15')).toEqual({ from: '2026-01-01', to: '2026-03-15' })
    expect(dashboardPeriodBounds('this_month', '2026-03-15')).toEqual({
      from: '2026-03-01',
      to: '2026-03-15',
    })
    expect(calendarDateOnly('2026-12-31T23:00:00.000Z')).toBe('2026-12-31')
  })

  it('includes NULL dates in Lifetime and excludes them from YTD and This Month', () => {
    expect(calendarDateInPeriod(null, 'lifetime', '2026-08-16')).toBe(true)
    expect(calendarDateInPeriod(null, 'ytd', '2026-08-16')).toBe(false)
    expect(calendarDateInPeriod(null, 'this_month', '2026-08-16')).toBe(false)
  })

  it('respects calendar year and month boundaries inclusively', () => {
    expect(calendarDateInPeriod('2025-12-31', 'ytd', '2026-01-01')).toBe(false)
    expect(calendarDateInPeriod('2026-01-01', 'ytd', '2026-08-16')).toBe(true)
    expect(calendarDateInPeriod('2026-08-16', 'ytd', '2026-08-16')).toBe(true)
    expect(calendarDateInPeriod('2026-08-17', 'ytd', '2026-08-16')).toBe(false)
    expect(calendarDateInPeriod('2026-07-31', 'this_month', '2026-08-16')).toBe(false)
    expect(calendarDateInPeriod('2026-08-01', 'this_month', '2026-08-16')).toBe(true)
    expect(calendarDateInPeriod('2026-08-16', 'this_month', '2026-08-16')).toBe(true)
    expect(calendarDateInPeriod('2026-08-17', 'this_month', '2026-08-16')).toBe(false)
  })
})
