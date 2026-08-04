import { describe, expect, it } from 'vitest'

/**
 * Focused Sprint 5.9 browser QA checklist (manual + harness-ready).
 * These assertions document required coverage; interactive UI QA remains manual.
 */
export const SPRINT_59_BROWSER_QA_CHECKLIST = [
  'owner campaign create/edit/disable',
  'advisor own campaign create/edit/disable',
  'advisor cross-card denial',
  'copy campaign link',
  'campaign QR download',
  'public card load with campaign params',
  'Let’s Connect attributed new/exact/possible matches',
  'Intake How We Met',
  'household overview/timeline How We Met',
  'Relationship Photo after attributed submission',
  'mobile layout',
  'no console errors',
  'no analytics dashboard',
  'no Case or assessment creation',
] as const

describe('Sprint 5.9 browser QA checklist', () => {
  it('covers required focused QA surfaces', () => {
    expect(SPRINT_59_BROWSER_QA_CHECKLIST).toContain('owner campaign create/edit/disable')
    expect(SPRINT_59_BROWSER_QA_CHECKLIST).toContain('campaign QR download')
    expect(SPRINT_59_BROWSER_QA_CHECKLIST).toContain('Intake How We Met')
    expect(SPRINT_59_BROWSER_QA_CHECKLIST).toContain('Relationship Photo after attributed submission')
    expect(SPRINT_59_BROWSER_QA_CHECKLIST).not.toContain('analytics dashboard writes')
  })
})
