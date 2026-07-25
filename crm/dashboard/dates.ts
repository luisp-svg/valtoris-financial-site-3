/**
 * Calendar-date helpers for CRM-9A due/overdue classification.
 * Due fields are Postgres `date` values — interpret in the viewer’s local timezone.
 * Do not hardcode America/Chicago.
 */

/** YYYY-MM-DD in the runtime local timezone. */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isValidDateOnly(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isDueToday(dueDate: string | null | undefined, today = localDateString()): boolean {
  return isValidDateOnly(dueDate) && dueDate === today
}

export function isOverdue(dueDate: string | null | undefined, today = localDateString()): boolean {
  return isValidDateOnly(dueDate) && dueDate < today
}

export function isUpcoming(dueDate: string | null | undefined, today = localDateString()): boolean {
  return isValidDateOnly(dueDate) && dueDate > today
}

/** Whole local calendar days between a timestamptz (or date) and `today`. */
export function calendarDaysSince(
  timestamp: string | null | undefined,
  today = localDateString(),
): number | null {
  if (!timestamp) return null
  const dateOnly = timestamp.slice(0, 10)
  if (!isValidDateOnly(dateOnly) || !isValidDateOnly(today)) return null
  const start = Date.UTC(
    Number(dateOnly.slice(0, 4)),
    Number(dateOnly.slice(5, 7)) - 1,
    Number(dateOnly.slice(8, 10)),
  )
  const end = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  )
  return Math.floor((end - start) / 86_400_000)
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!isValidDateOnly(value)) return 'No date'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
