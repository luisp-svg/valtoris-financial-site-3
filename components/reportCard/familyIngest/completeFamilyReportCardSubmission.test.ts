import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scoreFamilyAssessment } from '../../assessment/scoring/scoreFamilyAssessment'
import { DEMO_BUSINESS_ANSWERS } from '../businessReportCardData'
import { DEMO_RETIREMENT_ANSWERS } from '../retirementReportCardData'
import {
  validFamilyAnswersFixture,
  validProtectionAnswersFixture,
  validStudentLoanAnswersFixture,
} from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import {
  completeFamilyReportCardCrmSubmission,
  completePublicReportCardCrmSubmission,
} from './completeFamilyReportCardSubmission'
import { INITIAL_FAMILY_CONSENT_STATE } from './familyConsent'
import {
  beginNewFamilyAssessmentSession,
  clearFamilyIngestSession,
  ensureFamilySubmissionId,
} from './submissionSession'

function installMemorySessionStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => [...store.keys()][index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, String(value))
      },
    } satisfies Storage,
  })
}

const requiredConsent = {
  ...INITIAL_FAMILY_CONSENT_STATE,
  assessmentStorageAcknowledged: true,
  privacyAcknowledged: true,
}

describe('completeFamilyReportCardCrmSubmission', () => {
  beforeEach(() => {
    installMemorySessionStorage()
    clearFamilyIngestSession()
  })

  afterEach(() => {
    clearFamilyIngestSession()
    vi.unstubAllGlobals()
  })

  it('stays on form when required consent is missing', async () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const { result } = await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: INITIAL_FAMILY_CONSENT_STATE,
      session,
    })
    expect(result.ok).toBe(false)
    expect(result.navigateToResults).toBe(false)
    if (!result.ok) expect(result.code).toBe('consent_required')
  })

  it('navigates on CRM success even when Sheets sync failed', async () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'failed', errorCategory: 'timeout' },
        }),
        { status: 201 },
      ),
    )

    const { result, session: nextSession } = await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: fetchImpl as never },
    })

    expect(result.ok).toBe(true)
    expect(result.navigateToResults).toBe(true)
    if (result.ok) {
      expect(result.crm.sheetsSyncStatus).toBe('failed')
      expect(result.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    }
    expect(nextSession.status).toBe('succeeded')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('stays on form on CRM failure and reuses the same submission ID on retry', async () => {
    let session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const failingFetch = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 }))

    const first = await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: failingFetch as never },
    })
    expect(first.result.ok).toBe(false)
    expect(first.result.navigateToResults).toBe(false)
    expect(first.session.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(first.session.status).toBe('failed')

    session = first.session
    const successFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: false,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 200 },
      ),
    )

    const retry = await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      randomUuid: () => 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: successFetch as never },
    })

    expect(retry.result.ok).toBe(true)
    if (retry.result.ok) {
      expect(retry.result.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    }
    expect(successFetch).toHaveBeenCalled()
    const retryCalls = successFetch.mock.calls as unknown as Array<[unknown, RequestInit?]>
    const retryBody = JSON.parse(String(retryCalls[0]?.[1]?.body ?? '{}'))
    expect(retryBody.submissionId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('preserves client score comparison fields without changing scoring output', async () => {
    const answers = validFamilyAnswersFixture()
    const expected = scoreFamilyAssessment(answers)
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 201 },
      ),
    )

    await completeFamilyReportCardCrmSubmission({
      answers,
      consent: requiredConsent,
      session,
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: fetchImpl as never },
    })

    expect(fetchImpl).toHaveBeenCalled()
    const calls = fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit?]>
    const body = JSON.parse(String(calls[0]?.[1]?.body ?? '{}'))
    expect(body.clientReportedScore).toBe(expected.overallScore)
    expect(body.clientReportedGrade).toBe(expected.overallGrade)
    expect(body.website).toBe('')
    expect(body.assessmentType).toBe('family')
  })

  it('navigates on CRM success when API omits task-automation details (task failure must not block)', async () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
          // Public contract does not require task automation fields on the visitor response.
        }),
        { status: 201 },
      ),
    )

    const { result } = await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: fetchImpl as never },
    })

    expect(result.ok).toBe(true)
    expect(result.navigateToResults).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/task_failed|CRM_TASK|soft_deleted/i)
  })

  it('does not call Google Sheets from the browser orchestration path', async () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    ensureFamilySubmissionId(session, () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).not.toMatch(/script\.google\.com/)
      return new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 201 },
      )
    })

    await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: fetchImpl as never },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('/api/ingest-family-report-card')
  })

  it('sends a Family browser payload that ingest validation accepts with numeric formStartedAt', async () => {
    const session = beginNewFamilyAssessmentSession({ nowIso: '2026-07-28T20:00:00.000Z' })
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 201 },
      ),
    )

    await completeFamilyReportCardCrmSubmission({
      answers: validFamilyAnswersFixture(),
      consent: requiredConsent,
      session,
      nowIso: '2026-07-28T20:05:00.000Z',
      randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      submitOptions: { fetchImpl: fetchImpl as never },
    })

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit?])[1]?.body ?? '{}'))
    expect(typeof body.formStartedAt).toBe('number')
    expect(body.formStartedAt).toBe(Date.parse('2026-07-28T20:00:00.000Z'))
    expect(JSON.stringify(body)).not.toMatch(/"formStartedAt":"/)
    expect(typeof body.clientReportedScore).toBe('number')
    const validation = validateFamilyReportCardIngestRequest(body)
    expect(validation.ok).toBe(true)
    if (validation.ok) {
      expect(validation.value.clientReportedScore).toBe(scoreFamilyAssessment(validFamilyAnswersFixture()).overallScore)
    }
  })
})

describe('completePublicReportCardCrmSubmission wire contract', () => {
  beforeEach(() => {
    installMemorySessionStorage()
    clearFamilyIngestSession()
  })

  afterEach(() => {
    clearFamilyIngestSession()
    vi.unstubAllGlobals()
  })

  function okFetch() {
    return vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 201 },
      ),
    )
  }

  function postedBody(fetchImpl: ReturnType<typeof okFetch>) {
    const calls = fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit?]>
    return JSON.parse(String(calls[0]?.[1]?.body ?? '{}')) as Record<string, unknown>
  }

  it('sends numeric formStartedAt for Business, Retirement, and Protection', async () => {
    const startedIso = '2026-07-28T20:00:00.000Z'
    const cases: Array<{
      assessmentType: 'business' | 'retirement' | 'protection' | 'student_loan'
      answers: unknown
      phone: string
    }> = [
      { assessmentType: 'business', answers: DEMO_BUSINESS_ANSWERS, phone: DEMO_BUSINESS_ANSWERS.owner.phone },
      {
        assessmentType: 'retirement',
        answers: DEMO_RETIREMENT_ANSWERS,
        phone: DEMO_RETIREMENT_ANSWERS.household.phone,
      },
      {
        assessmentType: 'protection',
        answers: validProtectionAnswersFixture(),
        phone: validProtectionAnswersFixture().family.phone,
      },
      {
        assessmentType: 'student_loan',
        answers: validStudentLoanAnswersFixture(),
        phone: validStudentLoanAnswersFixture().contact.phone,
      },
    ]

    for (const testCase of cases) {
      const fetchImpl = okFetch()
      const session = beginNewFamilyAssessmentSession({ nowIso: startedIso })
      await completePublicReportCardCrmSubmission({
        assessmentType: testCase.assessmentType,
        answers: testCase.answers as never,
        consent: requiredConsent,
        session,
        phone: testCase.phone,
        nowIso: '2026-07-28T20:05:00.000Z',
        randomUuid: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        submitOptions: { fetchImpl: fetchImpl as never },
      })
      const body = postedBody(fetchImpl)
      expect(body.assessmentType, testCase.assessmentType).toBe(testCase.assessmentType)
      expect(typeof body.formStartedAt, testCase.assessmentType).toBe('number')
      expect(body.formStartedAt, testCase.assessmentType).toBe(Date.parse(startedIso))
      expect(JSON.stringify(body), testCase.assessmentType).not.toMatch(/"formStartedAt":"/)
      const validation = validateFamilyReportCardIngestRequest(body)
      expect(validation.ok, `${testCase.assessmentType} ${validation.ok ? '' : JSON.stringify(validation)}`).toBe(true)
      if (testCase.assessmentType === 'protection') {
        expect(body).not.toHaveProperty('clientReportedScore')
      } else {
        expect(typeof body.clientReportedScore).toBe('number')
      }
    }
  })
})
