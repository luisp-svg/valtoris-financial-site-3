import { extractCrmPpCode } from '../production/catalogErrors'

export const COMMISSION_WRITE_GENERIC_ERROR =
  'Unable to save this commission entry. Please try again.'

export const COMMISSION_IDEMPOTENCY_CONFLICT_ERROR =
  'This commission entry conflicts with a previous submission using the same operation key. Nothing new was recorded.'

export const COMMISSION_PRE_ISSUE_GATE_ERROR =
  'This application is not issued or in force, and no linked policy is available. Use Record pre-issue actual only when compensation was already received before that posting gate.'

const COMMISSION_WRITE_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'You do not have permission to record commission for this application.',
  not_authenticated: 'Sign in to record commission.',
  not_found: 'That commission record was not found.',
  missing_required_fields: 'Enter the required commission fields.',
  invalid_payload: 'That commission entry could not be saved. Check the amount, event type, and allocation.',
  invalid_transition: COMMISSION_PRE_ISSUE_GATE_ERROR,
  idempotency_conflict: COMMISSION_IDEMPOTENCY_CONFLICT_ERROR,
  delete_not_allowed: 'Posted commission events cannot be deleted. Reverse them instead.',
}

export function formatCommissionWriteUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && COMMISSION_WRITE_ERROR_MESSAGES[code]) return COMMISSION_WRITE_ERROR_MESSAGES[code]
  return COMMISSION_WRITE_GENERIC_ERROR
}

export function commissionWriteErrorCode(err: unknown): string | null {
  return extractCrmPpCode(err)
}
