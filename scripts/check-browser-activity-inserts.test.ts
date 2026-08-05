import { describe, expect, it } from 'vitest'
import { findBrowserActivityInserts } from './check-browser-activity-inserts.mjs'

describe('browser Activity INSERT guard', () => {
  it('permits zero production browser direct-insert modules', () => {
    const { violations, allowlist } = findBrowserActivityInserts()
    expect(allowlist).toEqual([])
    expect(violations).toEqual([])
  })

  it('does not allowlist recordActivity and keeps writers clean', () => {
    const { violations } = findBrowserActivityInserts()
    expect(violations.some((v) => v.file.includes('tasksApi.ts'))).toBe(false)
    expect(violations.some((v) => v.file.includes('onboardingApi.ts'))).toBe(false)
    expect(
      violations.some((v) => v.file === 'platform/activities/recordActivity.ts'),
    ).toBe(false)
  })
})
