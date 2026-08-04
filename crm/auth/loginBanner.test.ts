import { describe, expect, it } from 'vitest'
import { PASSWORD_UPDATED_BANNER } from './passwordRecovery'

/** Mirrors CrmLoginPage banner predicate for a focused contract test. */
function shouldShowPasswordUpdatedBanner(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('passwordUpdated') === '1'
}

describe('CRM login password-updated banner', () => {
  it('renders when passwordUpdated=1', () => {
    expect(shouldShowPasswordUpdatedBanner('?passwordUpdated=1')).toBe(true)
    expect(PASSWORD_UPDATED_BANNER).toBe('Password created. Sign in to continue.')
  })

  it('does not render for other query values', () => {
    expect(shouldShowPasswordUpdatedBanner('')).toBe(false)
    expect(shouldShowPasswordUpdatedBanner('?passwordUpdated=0')).toBe(false)
  })
})
