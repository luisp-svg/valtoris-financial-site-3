/**
 * Translate CRM_PP application-entry errors into safe user-facing copy.
 * Raw Postgres / PostgREST messages must never reach the UI.
 */

import { extractCrmPpCode } from './catalogErrors'

export const APPLICATION_GENERIC_ERROR = 'Unable to save this application. Please try again.'
export const APPLICATION_LOAD_ERROR = 'Unable to load application options. Please try again.'
export const APPLICATION_PARTIAL_FAILURE =
  'The draft was saved. Open the application to finish participants, allocations, or the stage change. Nothing was deleted.'

const APPLICATION_ERROR_MESSAGES: Record<string, string> = {
  missing_required_fields: 'Missing client or required fields.',
  invalid_payload: 'That application cannot be saved. Check the highlighted fields and try again.',
  invalid_participants:
    'Set the required participants for this product line. One household member may hold more than one role.',
  invalid_allocations: 'Writing allocations must total 100%.',
  invalid_premium: 'Premium information is incomplete.',
  invalid_transition: 'That stage change is not allowed. Catch-up must go Draft → Submitted → In underwriting.',
  not_found: 'That household, catalog item, or application was not found.',
  not_authorized: 'You do not have permission to update this application.',
  not_authenticated: 'Sign in to create a production application.',
  catalog_inactive: 'Choose an active carrier and product. Inactive catalog items cannot be used for new cases.',
  duplicate_application_number: 'That application number is already used for this carrier.',
  household_mismatch: 'The selected opportunity does not belong to this household.',
  advisor_invalid: 'Choose an active writing advisor.',
  participant_change_denied: 'This application can no longer be edited.',
  identifier_locked: 'That application number is already set. An owner can correct it with a reason.',
  invalid_disposition: 'That underwriting disposition is not allowed for this stage.',
}

export function formatApplicationUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && APPLICATION_ERROR_MESSAGES[code]) return APPLICATION_ERROR_MESSAGES[code]
  return APPLICATION_GENERIC_ERROR
}

export function applicationRecoveryCopy(applicationId: string): {
  message: string
  applicationId: string
} {
  return { message: APPLICATION_PARTIAL_FAILURE, applicationId }
}
