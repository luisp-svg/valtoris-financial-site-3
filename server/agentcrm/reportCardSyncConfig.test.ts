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
  FAMILY_CONTACT_SOURCE,
  FAMILY_SERVICE_TAG,
  PROTECTION_CONTACT_SOURCE,
  PROTECTION_SERVICE_TAG,
  RETIREMENT_CONTACT_SOURCE,
  RETIREMENT_SERVICE_TAG,
  STUDENT_LOAN_CONTACT_SOURCE,
  STUDENT_LOAN_SERVICE_TAG,
} from './reportCardSyncConfig'

describe('getReportCardAgentCrmConfig', () => {
  it('enables every current Report Card with its verified source label', () => {
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
    expect(getReportCardAgentCrmConfig('family')).toEqual({
      assessmentType: 'family',
      source: FAMILY_CONTACT_SOURCE,
      serviceTag: FAMILY_SERVICE_TAG,
      enabled: true,
    })
    expect(FAMILY_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.family)
    expect(FAMILY_CONTACT_SOURCE).toBe('Family Report Card')
    expect(FAMILY_CONTACT_SOURCE).not.toBe('Initial Financial Diagnostic')
    expect(FAMILY_SERVICE_TAG).toBe('service-family-planning')
    for (const specialist of [
      'service-life-insurance',
      'service-wills-trusts',
      'service-annuities-retirement',
      'service-retirement-planning',
      CREDIT_SERVICE_TAG,
      HOME_BUYER_SERVICE_TAG,
    ]) {
      expect(FAMILY_SERVICE_TAG).not.toBe(specialist)
    }
    expect(getReportCardAgentCrmConfig('retirement')).toEqual({
      assessmentType: 'retirement',
      source: RETIREMENT_CONTACT_SOURCE,
      serviceTag: RETIREMENT_SERVICE_TAG,
      enabled: true,
    })
    expect(RETIREMENT_CONTACT_SOURCE).toBe(LEAD_TYPE_BY_ASSESSMENT.retirement)
    expect(RETIREMENT_CONTACT_SOURCE).toBe('Retirement Report Card')
    expect(RETIREMENT_SERVICE_TAG).toBe('service-retirement-planning')
    expect(RETIREMENT_SERVICE_TAG).not.toBe('service-annuities-retirement')
    for (const specialist of [
      'service-annuities-retirement',
      'service-tax-strategies',
      'service-wills-trusts',
      'service-health-disability',
      'service-life-insurance',
    ]) {
      expect(RETIREMENT_SERVICE_TAG).not.toBe(specialist)
    }
  })

  it('leaves an unknown assessment type inactive', () => {
    expect(getReportCardAgentCrmConfig('not_a_report_card')).toBeNull()
  })
})
