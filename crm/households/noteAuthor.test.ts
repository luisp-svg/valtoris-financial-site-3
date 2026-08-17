import { describe, expect, it } from 'vitest'
import { crmNoteAuthorUserId } from './noteAuthor'

describe('crmNoteAuthorUserId', () => {
  it('uses the authenticated CRM profile id only', () => {
    expect(crmNoteAuthorUserId({ id: 'profile-1' })).toBe('profile-1')
    expect(crmNoteAuthorUserId({ id: '  profile-1  ' })).toBe('profile-1')
  })

  it('returns null when the current profile is missing', () => {
    expect(crmNoteAuthorUserId(null)).toBeNull()
    expect(crmNoteAuthorUserId(undefined)).toBeNull()
    expect(crmNoteAuthorUserId({ id: '' })).toBeNull()
    expect(crmNoteAuthorUserId({ id: '   ' })).toBeNull()
  })
})
