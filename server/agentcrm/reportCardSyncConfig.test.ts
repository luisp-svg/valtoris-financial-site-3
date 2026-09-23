import { describe, expect, it } from 'vitest'
import { LEAD_TYPE_BY_ASSESSMENT } from '../../modules/reportCard/publicIngestCatalog'
import {
  CREDIT_CONTACT_SOURCE,
  CREDIT_SERVICE_TAG,
  getReportCardAgentCrmConfig,
  STUDENT_LOAN_CONTACT_SOURCE,
  STUDENT_LOAN_SERVICE_TAG,
} from './reportCardSyncConfig'

const INACTIVE = ['family', 'business', 'protection', 'home_buyer', 'retirement'] as const

describe('getReportCardAgentCrmConfig', () => {
  it('enables Student Loan and Credit with their verified source labels', () => {
    expect(getReportCardAgentCrmConfig('student_loan')).toEqual({
      assessmentType: 'student_loan',
      source: STUDENT_LOAN_CONTACT_SOURCE,
      serviceTag: STUDENT_LOAN_SERVICE_TAG,
      enabled: true,
    })
    expect(getReportCardAgentCrmConfig('credit')).toEqual({
      assessmentType: 'credit',
      source: CREDIT_CONTACT_SOURCE,
      serviceTag: CREDIT_SERVICE_TAG,
      enabled: true,
    })
    expect(STUDENT_LOAN_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.student_loan)
    expect(CREDIT_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.credit)
    expect(STUDENT_LOAN_CONTACT_SOURCE).toBe('Student Loan Report Card')
    expect(CREDIT_CONTACT_SOURCE).toBe('Credit Report Card')
    expect(STUDENT_LOAN_SERVICE_TAG).toBe('service-student-loans')
    expect(CREDIT_SERVICE_TAG).toBe('service-credit-improvement')
  })

  it('leaves every other Report Card inactive', () => {
    for (const assessmentType of INACTIVE) {
      expect(getReportCardAgentCrmConfig(assessmentType)).toBeNull()
    }
  })
})
