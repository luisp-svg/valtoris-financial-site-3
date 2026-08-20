/**
 * Translate CRM_PP requirement errors into safe user-facing copy.
 * Raw Postgres / PostgREST messages must never reach the UI.
 */

import { extractCrmPpCode } from './catalogErrors'

export const REQUIREMENT_GENERIC_ERROR = 'Unable to update this requirement. Please try again.'
export const REQUIREMENT_LOAD_ERROR = 'Unable to load requirements. Please try again.'

const REQUIREMENT_ERROR_MESSAGES: Record<string, string> = {
  missing_required_fields: 'Enter the required fields.',
  invalid_payload: 'That requirement cannot be saved. Check the fields and try again.',
  invalid_requirement_code: 'That requirement type is not allowed for this product line.',
  invalid_requirement_transition: 'That status change is not allowed.',
  not_found: 'That requirement was not found.',
  not_authorized: 'You do not have permission to change this requirement.',
  not_authenticated: 'Sign in to update requirements.',
  delete_not_allowed: 'Requirements cannot be permanently deleted.',
}

export function formatRequirementUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && REQUIREMENT_ERROR_MESSAGES[code]) return REQUIREMENT_ERROR_MESSAGES[code]
  return REQUIREMENT_GENERIC_ERROR
}
