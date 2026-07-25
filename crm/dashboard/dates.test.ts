import { describe, expect, it } from 'vitest'
import {
  calendarDaysSince,
  isDueToday,
  isOverdue,
  isUpcoming,
  isValidDateOnly,
  localDateString,
} from './dates'

describe('localDateString', () => {
  it('formats a fixed local date as YYYY-MM-DD', () => {
    const value = localDateString(new Date(2026, 6, 25, 15, 30, 0))
    expect(value).toBe('2026-07-25')
  })
})

describe('date classification', () => {
  const today = '2026-07-25'

  it('validates date-only strings', () => {
    expect(isValidDateOnly('2026-07-25')).toBe(true)
    expect(isValidDateOnly('2026-7-25')).toBe(false)
    expect(isValidDateOnly(null)).toBe(false)
  })

  it('classifies due today, overdue, and upcoming', () => {
    expect(isDueToday('2026-07-25', today)).toBe(true)
    expect(isDueToday('2026-07-24', today)).toBe(false)
    expect(isOverdue('2026-07-19', today)).toBe(true)
    expect(isOverdue('2026-07-25', today)).toBe(false)
    expect(isOverdue(null, today)).toBe(false)
    expect(isUpcoming('2026-07-26', today)).toBe(true)
  })

  it('computes calendar days since a timestamp', () => {
    expect(calendarDaysSince('2026-07-11T16:13:11.880299+00:00', today)).toBe(14)
    expect(calendarDaysSince('2026-07-25T00:00:00.000Z', today)).toBe(0)
    expect(calendarDaysSince(null, today)).toBeNull()
  })
})
