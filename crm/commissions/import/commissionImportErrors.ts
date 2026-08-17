import { extractCrmPpCode } from '../../production/catalogErrors'

export const COMMISSION_IMPORT_GENERIC_ERROR =
  'Unable to save this commission import. Please try again.'

export const COMMISSION_IMPORT_LOAD_ERROR = 'Unable to load commission imports. Please try again.'

export const COMMISSION_IMPORT_STAGE_ERROR =
  'Unable to stage these commission rows. Nothing was posted to the ledger.'

const COMMISSION_IMPORT_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'You do not have permission to import commission statements.',
  not_authenticated: 'Sign in to import commission statements.',
  not_found: 'That commission import was not found.',
  missing_required_fields: 'Enter the required import fields.',
  invalid_payload:
    'That import could not be saved. Check the file, statement identifier, and row values.',
  idempotency_conflict: 'This import conflicts with a previous submission. Nothing new was staged.',
}

export function formatCommissionImportUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && COMMISSION_IMPORT_ERROR_MESSAGES[code]) return COMMISSION_IMPORT_ERROR_MESSAGES[code]
  return COMMISSION_IMPORT_GENERIC_ERROR
}

export function commissionImportErrorCode(err: unknown): string | null {
  return extractCrmPpCode(err)
}
