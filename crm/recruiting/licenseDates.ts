/** Licensing UI uses US calendar dates; API/storage remain ISO date-only strings. */
export function licenseDateLabel(value: string | null | undefined, fallback = 'No date'): string {
 if (!value) return fallback
 const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
 return match ? `${match[2]}/${match[3]}/${match[1]}` : value
}
export function licenseDateToIso(value: string): string | null {
 if (!value) return ''
 const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
 if (!match || Number(match[3]) < 1) return null
 const iso = `${match[3]}-${match[1]}-${match[2]}`
 const date = new Date(`${iso}T12:00:00Z`)
 return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === iso ? iso : null
}
