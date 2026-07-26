import { describe, expect, it } from 'vitest'
import { CRM_9B_DESKTOP_QA, CRM_9B_MOBILE_QA } from './browserQaChecklist'

describe('CRM-9B browser QA checklist', () => {
  it('includes desktop and mobile coverage items', () => {
    expect(CRM_9B_DESKTOP_QA.length).toBeGreaterThanOrEqual(10)
    expect(CRM_9B_MOBILE_QA.length).toBeGreaterThanOrEqual(5)
    expect(CRM_9B_DESKTOP_QA.some((item) => /Agency Operations/i.test(item))).toBe(true)
    expect(CRM_9B_DESKTOP_QA.some((item) => /Unassigned/i.test(item))).toBe(true)
    expect(CRM_9B_DESKTOP_QA.some((item) => /Chicago|closed_at/i.test(item))).toBe(true)
    expect(CRM_9B_MOBILE_QA.some((item) => /overflow|scroll/i.test(item))).toBe(true)
  })
})
