import { extractCrmPpCode } from './catalogErrors'

export const COMPENSATION_GENERIC_ERROR =
  'Unable to load compensation for this application. Please try again.'
export const EXPECTED_LIST_LOAD_ERROR =
  'Unable to load expected compensation. Production applications are still shown.'
export const PAID_LIST_LOAD_ERROR =
  'Unable to load commission paid totals. Production applications are still shown.'
export const ACTUAL_LOAD_ERROR =
  'Unable to load actual commission. Please try again.'

const COMPENSATION_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'You do not have permission to view this compensation.',
  not_authenticated: 'Sign in to view compensation.',
  not_found: 'Compensation for this application was not found.',
  invalid_payload: 'Unable to load compensation for this application. Please try again.',
}

export function formatCompensationUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && COMPENSATION_ERROR_MESSAGES[code]) return COMPENSATION_ERROR_MESSAGES[code]
  return COMPENSATION_GENERIC_ERROR
}
