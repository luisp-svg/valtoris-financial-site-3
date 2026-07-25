import { describe, expect, it } from 'vitest'
import { CRM_9A_DESKTOP_QA, CRM_9A_MOBILE_QA } from './browserQaChecklist'

describe('CRM-9A browser QA checklist', () => {
  it('includes desktop and mobile coverage items', () => {
    expect(CRM_9A_DESKTOP_QA.length).toBeGreaterThanOrEqual(8)
    expect(CRM_9A_MOBILE_QA.length).toBeGreaterThanOrEqual(6)
    expect(CRM_9A_DESKTOP_QA.some((item) => /owner/i.test(item))).toBe(true)
    expect(CRM_9A_MOBILE_QA.some((item) => /overflow/i.test(item))).toBe(true)
  })
})
