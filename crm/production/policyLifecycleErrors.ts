/**
 * Translate CRM_PP post-placement lifecycle errors into safe user-facing copy.
 * Raw Postgres / PostgREST messages must never reach the UI.
 * 12-month canceled vs surrendered classification stays on the 045 RPC.
 */
import { extractCrmPpCode } from './catalogErrors'

export const POLICY_LIFECYCLE_GENERIC_ERROR =
  'Unable to record this policy outcome. Please try again.'

export const POLICY_LIFECYCLE_DATE_OUTCOME_ERROR =
  'That termination date is not valid for the selected outcome. Canceled / Early Termination must be before the 12-month placement anniversary; Surrendered must be on or after it. Leave the date blank if the exact day is unknown.'

const POLICY_LIFECYCLE_ERROR_MESSAGES: Record<string, string> = {
  missing_required_fields: 'Enter a termination reason.',
  invalid_payload: POLICY_LIFECYCLE_DATE_OUTCOME_ERROR,
  invalid_transition:
    'This policy is not currently in force, so a canceled or surrendered outcome cannot be recorded.',
  not_found: 'This policy or application was not found.',
  not_authorized: 'Only the owner can record a canceled or surrendered policy outcome.',
  not_authenticated: 'Sign in to record a policy outcome.',
  household_mismatch: 'This policy is not linked to the same household as the application.',
}

export function formatPolicyLifecycleUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && POLICY_LIFECYCLE_ERROR_MESSAGES[code]) return POLICY_LIFECYCLE_ERROR_MESSAGES[code]
  return POLICY_LIFECYCLE_GENERIC_ERROR
}

export function policyLifecycleErrorCode(err: unknown): string | null {
  return extractCrmPpCode(err)
}
