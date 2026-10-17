import { describe, expect, it } from 'vitest'
import { REPORT_CARD_FOLLOW_UP_TARGET as target, reportCardFollowUpReady, reportCardTaskDueDate, reportCardContactOwner, reportCardFollowUpTarget, HEALTH_CONTACT_OWNER_ID, STUDENT_LOAN_CONTACT_OWNER_ID } from './reportCardFollowUpConfig'

describe('Report Card follow-up configuration', () => {
  it.each([['tsp',target.assignedUserId],['health',HEALTH_CONTACT_OWNER_ID]])('keeps %s contact ownership and follow-up tasks aligned', (type,owner) => {
    expect(reportCardContactOwner(type)).toBe(owner)
    expect(reportCardFollowUpTarget(type)).toEqual({...target,assignedUserId:owner})
  })
  it('preserves existing Student Loan contact ownership with Lizbeth and review tasks with Luis', () => {
    expect(reportCardContactOwner('student_loan')).toBe(STUDENT_LOAN_CONTACT_OWNER_ID)
    expect(reportCardFollowUpTarget('student_loan')).toEqual(target)
  })
  it.each(['family','business','retirement','protection','credit','home_buyer','unknown'])('preserves the existing %s follow-up default without overriding contact ownership', type => {
    expect(reportCardContactOwner(type)).toBeNull()
    expect(reportCardFollowUpTarget(type)).toEqual(target)
  })
  it.each([
    ['2026-09-28T18:00:00Z', '2026-09-29T14:00:00.000Z'],
    ['2026-09-26T01:00:00Z', '2026-09-28T14:00:00.000Z'],
    ['2026-03-06T18:00:00Z', '2026-03-09T14:00:00.000Z'],
    ['2026-10-30T18:00:00Z', '2026-11-02T15:00:00.000Z'],
    ['2026-12-31T18:00:00Z', '2027-01-01T15:00:00.000Z'],
  ])('uses next weekday at 9am Central for %s, including DST', (created, due) => {
    expect(reportCardTaskDueDate(created)).toBe(due)
  })
  it.each([undefined, '', 'invalid', 123])('rejects missing or invalid persisted dates (%s)', value => {
    expect(() => reportCardTaskDueDate(value)).toThrow('invalid_submission_date')
  })
  it('requires both routing attestations and the verified location', () => {
    const env = { AGENTCRM_REPORT_CARD_TRIGGERS_VERIFIED:'true', AGENTCRM_REPORT_CARD_DIRECT_FOLLOW_UP_VERIFIED:'true' }
    expect(reportCardFollowUpReady(env, target.locationId)).toBe(true)
    expect(reportCardFollowUpReady(env, 'other')).toBe(false)
    for (const key of Object.keys(env)) expect(reportCardFollowUpReady({...env,[key]:'false'}, target.locationId)).toBe(false)
  })
})
