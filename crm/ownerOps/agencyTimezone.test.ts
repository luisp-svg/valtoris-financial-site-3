import { describe, expect, it } from 'vitest'
import {
  AGENCY_TIMEZONE,
  agencyDateString,
  agencyMonthBounds,
  zonedLocalDateTimeToUtc,
} from './agencyTimezone'

describe('agencyTimezone', () => {
  it('uses America/Chicago as the agency timezone', () => {
    expect(AGENCY_TIMEZONE).toBe('America/Chicago')
  })

  it('formats wall-clock dates in Chicago', () => {
    // 2026-07-25 01:00 UTC = 2026-07-24 20:00 CDT
    const value = agencyDateString(new Date('2026-07-25T01:00:00.000Z'))
    expect(value).toBe('2026-07-24')
  })

  it('builds inclusive/exclusive month bounds in Chicago', () => {
    const bounds = agencyMonthBounds(new Date('2026-07-15T18:00:00.000Z'))
    expect(bounds.monthKey).toBe('2026-07')
    expect(bounds.timeZone).toBe('America/Chicago')
    expect(bounds.startIso).toBe(zonedLocalDateTimeToUtc(2026, 7, 1).toISOString())
    expect(bounds.endIso).toBe(zonedLocalDateTimeToUtc(2026, 8, 1).toISOString())
    expect(new Date(bounds.startIso).getTime()).toBeLessThan(new Date(bounds.endIso).getTime())
  })

  it('handles January rollover for month end', () => {
    const bounds = agencyMonthBounds(new Date('2026-01-10T12:00:00.000Z'))
    expect(bounds.monthKey).toBe('2026-01')
    expect(bounds.endIso).toBe(zonedLocalDateTimeToUtc(2026, 2, 1).toISOString())
  })
})
