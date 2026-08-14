/**
 * Translate CRM_PP catalog errors into safe user-facing copy.
 * Raw Postgres / PostgREST messages must never reach the UI.
 */

export const CATALOG_GENERIC_ERROR = 'Unable to save catalog changes. Please try again.'
export const CATALOG_LOAD_ERROR = 'Unable to load the catalog. Please try again.'

const CATALOG_ERROR_MESSAGES: Record<string, string> = {
  missing_required_fields: 'Enter the required fields.',
  invalid_payload:
    'That carrier or product cannot be saved. Check for duplicates or invalid values.',
  not_found: 'That catalog record was not found.',
  not_authorized: 'You do not have permission to change the catalog.',
  not_authenticated: 'Sign in to manage the catalog.',
  catalog_inactive: 'Products can only be added under an active carrier.',
  advisor_invalid: 'You do not have permission to change the catalog.',
  delete_not_allowed: 'Catalog records cannot be deleted. Deactivate them instead.',
}

const CRM_PP_CODE_RE = /CRM_PP:([a-z0-9_]+)/i

export function extractCrmPpCode(err: unknown): string | null {
  const parts: string[] = []
  if (typeof err === 'string') parts.push(err)
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    for (const key of ['message', 'details', 'hint', 'code']) {
      if (typeof rec[key] === 'string') parts.push(rec[key] as string)
    }
  }
  const blob = parts.join(' ')
  const match = blob.match(CRM_PP_CODE_RE)
  return match ? match[1].toLowerCase() : null
}

export function formatCatalogUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && CATALOG_ERROR_MESSAGES[code]) return CATALOG_ERROR_MESSAGES[code]
  return CATALOG_GENERIC_ERROR
}

export function isCrmPpError(err: unknown): boolean {
  return extractCrmPpCode(err) != null
}
