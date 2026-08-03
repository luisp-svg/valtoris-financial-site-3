import { describe, expect, it } from 'vitest'
import { scoreFamilyAssessment } from '../../assessment/scoring/scoreFamilyAssessment'
import { validFamilyAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { buildFamilyConsentSnapshot, INITIAL_FAMILY_CONSENT_STATE } from './familyConsent'
import { buildFamilyReportCardIngestPayload } from './buildFamilyIngestPayload'
import { createEmptyFamilyIngestSession } from './submissionSession'

describe('buildFamilyReportCardIngestPayload', () => {
  it('builds a Phase 2 contract payload with score comparison fields and consent', () => {
    const answers = validFamilyAnswersFixture()
    const scored = scoreFamilyAssessment(answers)
    const session = createEmptyFamilyIngestSession('2026-07-28T19:00:00.000Z')
    session.utm = {
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'spring',
      utmTerm: null,
      utmContent: null,
    }
    session.referrer = 'https://example.com/landing'

    const consent = buildFamilyConsentSnapshot({
      consent: {
        ...INITIAL_FAMILY_CONSENT_STATE,
        assessmentStorageAcknowledged: true,
        privacyAcknowledged: true,
        contactPermission: true,
      },
      phone: answers.family.phone,
      nowIso: '2026-07-28T20:00:00.000Z',
    })

    const payload = buildFamilyReportCardIngestPayload({
      submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      answers,
      session,
      consent,
      sourcePage: '/family-assessment',
      clientReportedScore: scored.overallScore,
      clientReportedGrade: scored.overallGrade,
      submittedAt: '2026-07-28T20:00:00.000Z',
      honeypotWebsite: '',
    })

    expect(payload.assessmentType).toBe('family')
    expect(payload.assessmentVersion).toBe(1)
    expect(payload.answers).toEqual(answers)
    expect(payload.clientReportedScore).toBe(scored.overallScore)
    expect(payload.clientReportedGrade).toBe(scored.overallGrade)
    expect(payload.utmSource).toBe('google')
    expect(payload.sourcePage).toBe('/family-assessment')
    expect(payload.formStartedAt).toBe('2026-07-28T19:00:00.000Z')
    expect(payload.website).toBe('')
    expect(payload.consent.assessmentStorageAcknowledged).toBe(true)
    expect(payload.consent.contactPermission).toBe(true)
    expect(payload.consent.emailMarketingConsent).toBe(false)
    expect(payload.consent.smsMarketingConsent).toBe(false)
    expect(payload).not.toHaveProperty('householdId')
    expect(payload).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('does not fabricate a server score on the client payload', () => {
    const answers = validFamilyAnswersFixture()
    const scored = scoreFamilyAssessment(answers)
    const payload = buildFamilyReportCardIngestPayload({
      submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      answers,
      session: createEmptyFamilyIngestSession(),
      consent: buildFamilyConsentSnapshot({
        consent: {
          ...INITIAL_FAMILY_CONSENT_STATE,
          assessmentStorageAcknowledged: true,
          privacyAcknowledged: true,
        },
        phone: answers.family.phone,
        nowIso: '2026-07-28T20:00:00.000Z',
      }),
      sourcePage: '/family-assessment',
      clientReportedScore: scored.overallScore,
      clientReportedGrade: scored.overallGrade,
    })
    expect(payload).not.toHaveProperty('serverCalculatedScore')
    expect(payload.clientReportedScore).toBe(scored.overallScore)
  })
})
