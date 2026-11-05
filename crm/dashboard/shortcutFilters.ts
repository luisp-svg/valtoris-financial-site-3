import { agencyMonthBounds } from '../ownerOps/agencyTimezone'

export function closedMonthFromParams(params: URLSearchParams): string | null {
  const month = params.get('closedMonth')
  return month && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(month) ? month : null
}

/** Same agency timezone and inclusive/exclusive boundaries as the snapshot counts. */
export function filterClosedMonth<T extends { closed_at: string | null }>(items: readonly T[], month: string | null): T[] {
  if (!month) return [...items]
  const { startIso, endIso } = agencyMonthBounds(new Date(`${month}-15T12:00:00Z`))
  const start = Date.parse(startIso), end = Date.parse(endIso)
  return items.filter(item => {
    const closed = item.closed_at ? Date.parse(item.closed_at) : NaN
    return closed >= start && closed < end
  })
}
