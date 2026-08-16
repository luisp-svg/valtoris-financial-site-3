/**
 * Translate CRM_PP stage-transition errors into safe user-facing copy.
 * Raw Postgres / PostgREST messages must never reach the UI.
 */
import { extractCrmPpCode } from './catalogErrors'

export const STAGE_TRANSITION_GENERIC_ERROR = 'Unable to update the stage. Please try again.'

const STAGE_TRANSITION_ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: 'That stage change is not allowed from the current stage.',
  not_authorized: 'You do not have permission to change this stage.',
  not_authenticated: 'Sign in to update the production stage.',
  not_found: 'This production application was not found.',
  missing_required_fields:
    'This stage change needs a required field, such as a policy number or a reason.',
  invalid_payload: 'That stage change could not be saved. Check the required fields and try again.',
  invalid_participants:
    'Set the required participants for this product line before changing stage.',
  invalid_allocations:
    'Writing commission and production credit must each total exactly 10,000 basis points before this stage change.',
  invalid_premium: 'Enter a valid premium or deposit for this product line before changing stage.',
  invalid_disposition: 'That underwriting disposition is not allowed for this stage.',
  invalid_delivery_status: 'Delivery status must be complete or not required before placing in force.',
  duplicate_policy_number: 'That policy number is already used for this carrier.',
  duplicate_link: 'This application is already linked to a policy and cannot be issued again.',
  issue_failed: 'The policy could not be issued. Check required case fields and try again.',
}

export function formatStageTransitionUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && STAGE_TRANSITION_ERROR_MESSAGES[code]) return STAGE_TRANSITION_ERROR_MESSAGES[code]
  return STAGE_TRANSITION_GENERIC_ERROR
}
