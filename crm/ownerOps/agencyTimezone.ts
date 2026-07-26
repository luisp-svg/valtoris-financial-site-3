/**
 * Agency business timezone for CRM-9B month boundaries (won/lost this month).
 * Due-today / overdue remain viewer-local via crm/dashboard/dates.ts.
 */
export const AGENCY_TIMEZONE = 'America/Chicago'

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function zonedParts(date: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** Wall-clock YYYY-MM-DD in the agency timezone. */
export function agencyDateString(date = new Date(), timeZone = AGENCY_TIMEZONE): string {
  const parts = zonedParts(date, timeZone)
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${parts.year}-${m}-${d}`
}

/**
 * Convert a wall-clock local datetime in `timeZone` to a UTC Date.
 * Iteratively corrects DST/offset using Intl.
 */
export function zonedLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = AGENCY_TIMEZONE,
): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  for (let i = 0; i < 4; i += 1) {
    const wall = zonedParts(utc, timeZone)
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
    const wallAsUtc = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    )
    const diff = desiredAsUtc - wallAsUtc
    if (diff === 0) break
    utc = new Date(utc.getTime() + diff)
  }
  return utc
}

export type AgencyMonthBounds = {
  /** Inclusive start (UTC ISO). */
  startIso: string
  /** Exclusive end (UTC ISO). */
  endIso: string
  /** YYYY-MM label in agency timezone. */
  monthKey: string
  timeZone: string
}

/** Current calendar month in the agency timezone: [start, end). */
export function agencyMonthBounds(
  now = new Date(),
  timeZone = AGENCY_TIMEZONE,
): AgencyMonthBounds {
  const parts = zonedParts(now, timeZone)
  const start = zonedLocalDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0, timeZone)
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year
  const end = zonedLocalDateTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, timeZone)
  const monthKey = `${parts.year}-${String(parts.month).padStart(2, '0')}`
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthKey,
    timeZone,
  }
}
