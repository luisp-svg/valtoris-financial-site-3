import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { isContactComplete, type RetirementAssessmentAnswers } from './types'
import type { ConsentSnapshot } from '../../../server/ingest/familyReportCard/types'
import { retirementCopy } from './copy'
import { resolveSpecializedCopy } from '../specialized/locale'
import StepRetirementContact from '../steps/retirement/StepRetirementContact'
import { validRetirementIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import { scoreRetirementAssessment } from '../scoring/scoreRetirementAssessment'

function fixture() {
  return validRetirementIngestRequestBodyFixture() as { answers: RetirementAssessmentAnswers; consent: ConsentSnapshot }
}

describe('Retirement optional follow-up consent', () => {
  it('accepts a complete diagnostic without contact permission or contact preferences', () => {
    const request = fixture()
    request.answers.leadDetails = { preferredContactMethod: '', bestContactTime: '', primaryConcern: '', consentGiven: 'no' }
    request.consent.contactPermission = false
    request.consent.emailMarketingConsent = false
    request.consent.smsMarketingConsent = false
    expect(isContactComplete(request.answers.household, request.answers.leadDetails)).toBe(true)
    expect(validateFamilyReportCardIngestRequest(request).ok).toBe(true)
    request.answers.household.email = ''
    expect(isContactComplete(request.answers.household, request.answers.leadDetails)).toBe(false)
  })

  it('does not change scores when follow-up consent and preferences are absent', () => {
    const request = fixture()
    const before = scoreRetirementAssessment(request.answers)
    request.answers.leadDetails = { preferredContactMethod: '', bestContactTime: '', primaryConcern: '', consentGiven: 'no' }
    expect(scoreRetirementAssessment(request.answers)).toEqual(before)
  })

  it.each(['en', 'es'] as const)('does not render a second consent checkbox in %s', (locale) => {
    const { answers } = fixture()
    const html = renderToStaticMarkup(createElement(StepRetirementContact, {
      t: (section, key) => resolveSpecializedCopy(retirementCopy, locale, section, key),
      household: answers.household,
      leadDetails: answers.leadDetails,
      onHouseholdChange: () => {},
      onLeadDetailsChange: () => {},
    }))
    expect(html).not.toContain('assessment-consentGiven')
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toMatch(/name="preferredContactMethod"[^>]*required/)
  })
})
