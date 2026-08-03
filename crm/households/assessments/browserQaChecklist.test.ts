import { describe, expect, it } from 'vitest'
import { HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST } from './browserQaChecklist'

describe('household IFD browser QA checklist', () => {
  it('covers overview, history, detail, duplicate regression, and privacy blocker', () => {
    expect(HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST.length).toBeGreaterThanOrEqual(8)
    expect(HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Initial Financial Diagnostic/i)
    expect(HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Financial Progress/i)
    expect(HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Privacy Policy/i)
    expect(HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST.join(' ')).not.toMatch(/Playwright automatically verified/i)
  })
})
