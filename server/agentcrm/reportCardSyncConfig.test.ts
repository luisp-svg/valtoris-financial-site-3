import { describe, expect, it } from 'vitest'
import { LEAD_TYPE_BY_ASSESSMENT } from '../../modules/reportCard/publicIngestCatalog'
import {
  CREDIT_CONTACT_SOURCE,
  CREDIT_SERVICE_TAG,
  getReportCardAgentCrmConfig,
  HOME_BUYER_CONTACT_SOURCE,
  HOME_BUYER_SERVICE_TAG,
  BUSINESS_CONTACT_SOURCE,
  BUSINESS_SERVICE_TAG,
  PROTECTION_CONTACT_SOURCE,
  PROTECTION_SERVICE_TAG,
  STUDENT_LOAN_CONTACT_SOURCE,
  STUDENT_LOAN_SERVICE_TAG,
} from './reportCardSyncConfig'

const INACTIVE = ['family', 'retirement'] as const

describe('getReportCardAgentCrmConfig', () => {
  it('enables Student Loan, Credit, Home Buyer, and Protection with their verified source labels', () => {
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
    expect(getReportCardAgentCrmConfig('home_buyer')).toEqual({
      assessmentType: 'home_buyer',
      source: HOME_BUYER_CONTACT_SOURCE,
      serviceTag: HOME_BUYER_SERVICE_TAG,
      enabled: true,
    })
    expect(STUDENT_LOAN_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.student_loan)
    expect(CREDIT_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.credit)
    expect(HOME_BUYER_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.home_buyer)
    expect(STUDENT_LOAN_CONTACT_SOURCE).toBe('Student Loan Report Card')
    expect(CREDIT_CONTACT_SOURCE).toBe('Credit Report Card')
    expect(HOME_BUYER_CONTACT_SOURCE).toBe('Home Buyer Report Card')
    expect(STUDENT_LOAN_SERVICE_TAG).toBe('service-student-loans')
    expect(CREDIT_SERVICE_TAG).toBe('service-credit-improvement')
    expect(HOME_BUYER_SERVICE_TAG).toBe('service-home-buyer-readiness')
    expect(HOME_BUYER_SERVICE_TAG).not.toBe('service-home-auto')
    expect(HOME_BUYER_SERVICE_TAG).not.toBe(CREDIT_SERVICE_TAG)
    expect(getReportCardAgentCrmConfig('protection')).toEqual({
      assessmentType: 'protection',
      source: PROTECTION_CONTACT_SOURCE,
      serviceTag: PROTECTION_SERVICE_TAG,
      enabled: true,
    })
    expect(PROTECTION_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.protection)
    expect(PROTECTION_CONTACT_SOURCE).toBe('Protection Gap')
    expect(PROTECTION_CONTACT_SOURCE).not.toBe('Protection Report Card')
    expect(PROTECTION_SERVICE_TAG).toBe('service-life-insurance')
    expect(PROTECTION_SERVICE_TAG).not.toBe('service-health-disability')
    expect(PROTECTION_SERVICE_TAG).not.toBe('service-home-auto')
    expect(PROTECTION_SERVICE_TAG).not.toBe(CREDIT_SERVICE_TAG)
    expect(getReportCardAgentCrmConfig('business')).toEqual({
      assessmentType: 'business',
      source: BUSINESS_CONTACT_SOURCE,
      serviceTag: BUSINESS_SERVICE_TAG,
      enabled: true,
    })
    expect(BUSINESS_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.business)
    expect(BUSINESS_CONTACT_SOURCE).toBe('Business Report Card')
    expect(BUSINESS_SERVICE_TAG).toBe('service-business-planning')
    for (const specialist of [
      'service-llc-setup',
      'service-tax-strategies',
      'service-payment-processing',
      'service-commercial-insurance',
      'service-employee-benefits',
      'service-credit-improvement',
    ]) {
      expect(BUSINESS_SERVICE_TAG).not.toBe(specialist)
    }
  })

  it('leaves every other Report Card inactive', () => {
    for (const assessmentType of INACTIVE) {
      expect(getReportCardAgentCrmConfig(assessmentType)).toBeNull()
    }
  })
})
