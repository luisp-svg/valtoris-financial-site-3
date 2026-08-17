/**
 * Dashboard reporting periods using local calendar YYYY-MM-DD strings.
 * Avoids UTC Date parsing that can shift a record to an adjacent day.
 */
export const DASHBOARD_REPORTING_PERIODS = ['lifetime', 'ytd', 'this_month'] as const
export type DashboardReportingPeriod = (typeof DASHBOARD_REPORTING_PERIODS)[number]

export const DEFAULT_PRODUCTION_DASHBOARD_PERIOD: DashboardReportingPeriod = 'lifetime'
export const DEFAULT_COMPENSATION_DASHBOARD_PERIOD: DashboardReportingPeriod = 'this_month'

export function isDashboardReportingPeriod(value: string): value is DashboardReportingPeriod {
  return (DASHBOARD_REPORTING_PERIODS as readonly string[]).includes(value)
}

export function isCalendarDateOnly(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** First 10 chars of a Postgres date or timestamptz. Null/invalid → null. */
export function calendarDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const day = value.slice(0, 10)
  return isCalendarDateOnly(day) ? day : null
}

export type DashboardPeriodBounds = {
  from: string | null
  to: string
}

export function dashboardPeriodBounds(
  period: DashboardReportingPeriod,
  today: string,
): DashboardPeriodBounds {
  if (!isCalendarDateOnly(today)) {
    throw new Error('dashboardPeriodBounds requires a YYYY-MM-DD reference date')
  }
  if (period === 'lifetime') return { from: null, to: today }
  const year = today.slice(0, 4)
  if (period === 'ytd') return { from: `${year}-01-01`, to: today }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

/**
 * Inclusive calendar-date membership.
 * Lifetime includes records with a NULL date (existing Phase A behavior).
 * YTD / This Month exclude NULL and invalid dates.
 */
export function calendarDateInPeriod(
  value: string | null | undefined,
  period: DashboardReportingPeriod,
  today: string,
): boolean {
  const day = calendarDateOnly(value)
  if (period === 'lifetime') return true
  if (!day) return false
  const { from, to } = dashboardPeriodBounds(period, today)
  if (from && day < from) return false
  if (day > to) return false
  return true
}

export function productionDashboardPeriodLabel(period: DashboardReportingPeriod): string {
  if (period === 'ytd') return 'YTD'
  if (period === 'this_month') return 'This Month'
  return 'Lifetime'
}
