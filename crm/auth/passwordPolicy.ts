export type PasswordPolicyIssue =
  | 'too_short'
  | 'missing_uppercase'
  | 'missing_lowercase'
  | 'missing_number'
  | 'missing_symbol'
  | 'mismatch'

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; issues: PasswordPolicyIssue[]; message: string }

export const PASSWORD_MIN_LENGTH = 12

const ISSUE_MESSAGES: Record<PasswordPolicyIssue, string> = {
  too_short: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  missing_uppercase: 'Password must include at least one uppercase letter.',
  missing_lowercase: 'Password must include at least one lowercase letter.',
  missing_number: 'Password must include at least one number.',
  missing_symbol: 'Password must include at least one symbol.',
  mismatch: 'Passwords do not match.',
}

/**
 * Validate a new CRM password. Values are checked as submitted (not trimmed)
 * so whitespace is significant; length/class checks use the raw password.
 */
export function validateNewPassword(password: string, confirmation: string): PasswordPolicyResult {
  const issues: PasswordPolicyIssue[] = []

  if (password.length < PASSWORD_MIN_LENGTH) issues.push('too_short')
  if (!/[A-Z]/.test(password)) issues.push('missing_uppercase')
  if (!/[a-z]/.test(password)) issues.push('missing_lowercase')
  if (!/[0-9]/.test(password)) issues.push('missing_number')
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('missing_symbol')
  if (password !== confirmation) issues.push('mismatch')

  if (issues.length === 0) return { ok: true }

  return {
    ok: false,
    issues,
    message: ISSUE_MESSAGES[issues[0]],
  }
}

export function passwordToggleAriaLabel(field: 'password' | 'confirmation', visible: boolean): string {
  const noun = field === 'password' ? 'new password' : 'password confirmation'
  return visible ? `Hide ${noun}` : `Show ${noun}`
}
