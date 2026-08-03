import { describe, expect, it } from 'vitest'
import { INTAKE_BROWSER_QA_CHECKLIST } from './browserQaChecklist'

describe('intake browser QA checklist', () => {
  it('covers intake queue, detail, duplicate resolution, and privacy release note', () => {
    expect(INTAKE_BROWSER_QA_CHECKLIST.length).toBeGreaterThanOrEqual(12)
    expect(INTAKE_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Initial Financial Diagnostic/i)
    expect(INTAKE_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Confirm Same Household/i)
    expect(INTAKE_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/owner-only/i)
    expect(INTAKE_BROWSER_QA_CHECKLIST.join(' ')).toMatch(/Privacy Policy/i)
    expect(INTAKE_BROWSER_QA_CHECKLIST.join(' ')).not.toMatch(/Playwright automatically verified/i)
  })
})
