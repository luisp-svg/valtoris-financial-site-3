import { describe, expect, it } from 'vitest'
import { validFamilyAnswersFixture, validIngestRequestBodyFixture, validBusinessIngestRequestBodyFixture, validRetirementIngestRequestBodyFixture, validProtectionIngestRequestBodyFixture } from './testFixtures'
import { validateFamilyReportCardIngestRequest } from './validation'

describe('validateFamilyReportCardIngestRequest', () => {
  it('accepts a fully valid submission', () => {
    const result = validateFamilyReportCardIngestRequest(validIngestRequestBodyFixture())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.submissionId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(result.value.assessmentType).toBe('family')
      if ('family' in result.value.answers) {
        expect(result.value.answers.family.firstName).toBe('Jamie')
      }
      expect(result.value.consent.assessmentStorageAcknowledged).toBe(true)
    }
  })

  it('rejects a non-object body', () => {
    expect(validateFamilyReportCardIngestRequest('nope').ok).toBe(false)
    expect(validateFamilyReportCardIngestRequest(null).ok).toBe(false)
    expect(validateFamilyReportCardIngestRequest([1, 2, 3]).ok).toBe(false)
  })

  it('rejects an oversized body', () => {
    const huge = validIngestRequestBodyFixture({ sourcePage: 'x'.repeat(200_000) })
    const result = validateFamilyReportCardIngestRequest(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('payload_too_large')
  })

  it('rejects unknown top-level keys', () => {
    const body = validIngestRequestBodyFixture({ extraField: 'not allowed' })
    const result = validateFamilyReportCardIngestRequest(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_field')
  })

  it('rejects an invalid submissionId', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ submissionId: 'not-a-uuid' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_submission_id')
  })

  it('rejects assessmentType values outside the public report-card allowlist', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentType: 'household_onboarding' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_assessment_type')
  })

  it('rejects browser-supplied advisor UUIDs', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ originalAdvisorId: '11111111-1111-4111-8111-111111111111' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('trusted_advisor_id_forbidden')
  })

  it('rejects a non-numeric assessmentVersion', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentVersion: '1' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_assessment_version')
  })

  it('rejects incomplete family answers', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, family: { ...answers.family, firstName: '' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_family_answers')
  })

  it('rejects incomplete financial answers', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, financial: { ...answers.financial, householdIncome: '' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_financial_answers')
  })

  it('rejects incomplete protection answers', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, protection: { ...answers.protection, hasWill: '' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_protection_answers')
  })

  it('rejects empty goals selection', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, goals: { selected: [] } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_goals_answers')
  })

  it('rejects a malformed email address', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, family: { ...answers.family, email: 'not-an-email' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_email')
  })

  it('rejects a phone number with no digits', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, family: { ...answers.family, phone: 'n/a' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_phone')
  })

  it('rejects a first/last name over the max length', () => {
    const answers = validFamilyAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...answers, family: { ...answers.family, firstName: 'a'.repeat(101) } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_name')
  })

  it('rejects a non-empty honeypot "website" field', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ website: 'http://spam.example.com' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bot_suspected')
  })

  it('rejects a non-empty honeypot "companyUrl" field', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ companyUrl: 'spam' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bot_suspected')
  })

  it('allows an empty honeypot field', () => {
    const result = validateFamilyReportCardIngestRequest(validIngestRequestBodyFixture({ website: '' }))
    expect(result.ok).toBe(true)
  })

  it('rejects submissions filled out faster than the minimum human fill time', () => {
    const now = () => 1_000_000
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ formStartedAt: 999_800 }),
      { now },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('submission_too_fast')
  })

  it('accepts submissions that took long enough to fill out', () => {
    const now = () => 1_000_000
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ formStartedAt: 990_000 }),
      { now },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects an out-of-range clientReportedScore', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ clientReportedScore: 150 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_client_score')
  })

  it('rejects a malformed submittedAt', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ submittedAt: 'not-a-date' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_submitted_at')
  })

  it('normalizes missing consent to all-false / not_provided', () => {
    const body = validIngestRequestBodyFixture()
    delete body.consent
    const result = validateFamilyReportCardIngestRequest(body)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.consent.assessmentStorageAcknowledged).toBe(false)
      expect(result.value.consent.contactPermission).toBe(false)
      expect(result.value.consent.emailMarketingConsent).toBe(false)
      expect(result.value.consent.smsMarketingConsent).toBe(false)
      expect(result.value.consent.privacyAcknowledged).toBe(false)
      expect(result.value.consent.consentVersion).toBeNull()
      expect(result.value.consent.consentedAt).toBeNull()
    }
  })

  it('normalizes a malformed consent object leniently instead of rejecting', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ consent: { privacyAcknowledged: true, garbage: true } }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.consent.privacyAcknowledged).toBe(true)
      expect(result.value.consent.contactPermission).toBe(false)
    }
  })

  it('accepts business, retirement, and protection assessment types with matching answers', () => {
    expect(validateFamilyReportCardIngestRequest(validBusinessIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validRetirementIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validProtectionIngestRequestBodyFixture()).ok).toBe(true)
  })

  it('rejects a lead-type spoof field and advisorProfileId as unknown', () => {
    expect(
      validateFamilyReportCardIngestRequest(validIngestRequestBodyFixture({ leadType: 'Family Report Card' })).ok,
    ).toBe(false)
    expect(
      validateFamilyReportCardIngestRequest(
        validIngestRequestBodyFixture({ advisorProfileId: '11111111-1111-4111-8111-111111111111' }),
      ).ok,
    ).toBe(false)
  })

  it('accepts an opaque card public key without trusting an advisor UUID', () => {
    const result = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ cardPublicKey: 'pk_live_abcdefghijklmnop' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.cardPublicKey).toBe('pk_live_abcdefghijklmnop')
  })
})
