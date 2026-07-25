import type { DashboardLoadResult } from './types'

export function formatDashboardError(source: string, error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string }
    const parts = [
      `${source} failed`,
      e.message ? `message=${e.message}` : null,
      e.code ? `code=${e.code}` : null,
      e.details ? `details=${e.details}` : null,
      e.hint ? `hint=${e.hint}` : null,
    ].filter(Boolean)
    if (parts.length > 1) return parts.join(' | ')
  }
  if (error instanceof Error && error.message) {
    return `${source} failed | message=${error.message}`
  }
  return `${source} failed | message=Unknown error`
}

export async function settleDashboardLoad<T>(
  promise: Promise<T>,
  fallback: T,
  source: string,
): Promise<DashboardLoadResult<T>> {
  try {
    const value = await promise
    return { ok: true, value }
  } catch (error) {
    const formatted = formatDashboardError(source, error)
    if (import.meta.env.DEV) {
      console.error('[crm/dashboard]', formatted)
    }
    return { ok: false, value: fallback, error: formatted }
  }
}

export function sectionErrorMessage(result: DashboardLoadResult<unknown> | undefined): string | null {
  if (!result || result.ok) return null
  return 'Unable to load this section. Please try again.'
}

export function isSectionEmpty<T>(
  result: DashboardLoadResult<T[]> | undefined,
  loading: boolean,
): boolean {
  if (loading || !result || !result.ok) return false
  return result.value.length === 0
}
