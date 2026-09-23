import { describe, expect, it } from 'vitest'
import {
  getReportCardAgentCrmConfig,
  STUDENT_LOAN_CONTACT_SOURCE,
  STUDENT_LOAN_SERVICE_TAG,
} from './reportCardSyncConfig'

const INACTIVE = ['credit', 'family', 'business', 'protection', 'home_buyer', 'retirement'] as const

describe('getReportCardAgentCrmConfig', () => {
  it('enables only the Student Loan Report Card', () => {
    expect(getReportCardAgentCrmConfig('student_loan')).toEqual({
      assessmentType: 'student_loan',
      source: STUDENT_LOAN_CONTACT_SOURCE,
      serviceTag: STUDENT_LOAN_SERVICE_TAG,
      enabled: true,
    })
    expect(STUDENT_LOAN_CONTACT_SOURCE).toBe('Student Loan Report Card')
    expect(STUDENT_LOAN_SERVICE_TAG).toBe('service-student-loans')
  })

  it('leaves every other Report Card inactive', () => {
    for (const assessmentType of INACTIVE) {
      expect(getReportCardAgentCrmConfig(assessmentType)).toBeNull()
    }
  })
})
