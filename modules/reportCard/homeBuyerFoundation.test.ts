import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../constants/routes'
import { validIngestRequestBodyFixture } from '../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../server/ingest/familyReportCard/validation'
import { HOME_BUYER_REPORT_CARD_SCORING_VERSION } from '../../server/ingest/familyReportCard/types'
import {
  HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT,
  LEAD_TYPE_BY_ASSESSMENT,
  PUBLIC_REPORT_CARD_ASSESSMENT_TYPES,
  PUBLIC_REPORT_CARD_LEAD_TYPES,
  PUBLIC_REPORT_CARD_SCORING_VERSION,
  REPORT_PATH_BY_ASSESSMENT,
  assessmentTypeForLeadType,
  crmProductLabelForAssessment,
  crmProductLabelForLeadType,
  isPublicReportCardAssessmentType,
  leadTypeForAssessment,
} from './publicIngestCatalog'
import {
  HOME_BUYER_ASSESSMENT_TYPE,
  SPECIALIZED_ASSESSMENT_PRODUCTS,
  isSpecializedAssessmentProduct,
} from './specializedAssessmentCatalog'

describe('Home Buyer Batch 1 catalog foundation', () => {
  it('accepts home_buyer with locked identifiers and leaves existing mappings unchanged', () => {
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
      'credit',
      'home_buyer',
    ])
    expect(isPublicReportCardAssessmentType('home_buyer')).toBe(true)
    expect(isPublicReportCardAssessmentType('household_onboarding')).toBe(false)
    expect(LEAD_TYPE_BY_ASSESSMENT.home_buyer).toBe('Home Buyer Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.home_buyer).toBe('home_buyer_report_card')
    expect(REPORT_PATH_BY_ASSESSMENT.home_buyer).toBe('/home-buyer-results')
    expect(PUBLIC_REPORT_CARD_SCORING_VERSION.home_buyer).toBe(1)
    expect(HOME_BUYER_REPORT_CARD_SCORING_VERSION).toBe(1)
    expect(leadTypeForAssessment('home_buyer')).toBe('Home Buyer Report Card')
    expect(crmProductLabelForAssessment('home_buyer')).toBe('Home Buyer Report Card')
    expect(crmProductLabelForLeadType('Home Buyer Report Card')).toBe('Home Buyer Report Card')
    expect(assessmentTypeForLeadType('Home Buyer Report Card')).toBe('home_buyer')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Home Buyer Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.family).toBe('Family Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.business).toBe('Business Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.retirement).toBe('Retirement Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.protection).toBe('Protection Gap')
    expect(LEAD_TYPE_BY_ASSESSMENT.student_loan).toBe('Student Loan Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.credit).toBe('Credit Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.credit).toBe('credit_report_card')
  })

  it('registers home_buyer as a specialized product without changing Student Loan or Credit identities', () => {
    expect(HOME_BUYER_ASSESSMENT_TYPE).toBe('home_buyer')
    expect(SPECIALIZED_ASSESSMENT_PRODUCTS).toEqual(['student_loan', 'credit', 'home_buyer'])
    expect(isSpecializedAssessmentProduct('home_buyer')).toBe(true)
    expect(isSpecializedAssessmentProduct('family')).toBe(false)
    expect(isSpecializedAssessmentProduct('credit')).toBe(true)
    expect(isSpecializedAssessmentProduct('student_loan')).toBe(true)
  })

  it('locks future public routes without adding the marketing alias', () => {
    expect(ROUTES.homeBuyerReportCard).toBe('/home-buyer-report-card')
    expect(ROUTES.homeBuyerAssessment).toBe('/home-buyer-assessment')
    expect(ROUTES.homeBuyerReportCardResults).toBe('/home-buyer-results')
    expect(Object.values(ROUTES)).not.toContain('/home-buyer')
  })

  it('accepts home_buyer as an assessment type and rejects answers until Batch 2', () => {
    const acceptedType = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentType: 'home_buyer' }),
    )
    expect(acceptedType.ok).toBe(false)
    if (!acceptedType.ok) expect(acceptedType.code).toBe('home_buyer_answers_unavailable')

    const unsupported = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentType: 'household_onboarding' }),
    )
    expect(unsupported.ok).toBe(false)
    if (!unsupported.ok) expect(unsupported.code).toBe('invalid_assessment_type')
  })
})
