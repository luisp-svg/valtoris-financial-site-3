import { describe, expect, it, vi } from 'vitest'
import {
  answersToApiPayload,
  buildAnswersDocumentForSave,
  describeDraftFreshnessFailure,
  evaluateDraftFreshness,
  isAnswersDirty,
  serializeAnswersBaseline,
} from './onboardingPersistence'
import { createEmptyOnboardingAnswers } from './onboardingSchema'
import { answersFixture } from './testFixtures'

describe('onboarding persistence helpers', () => {
  it('detects dirty state against a saved baseline', () => {
    const answers = createEmptyOnboardingAnswers({
      startedAt: '2026-07-01T00:00:00.000Z',
    })
    const baseline = serializeAnswersBaseline(answers)
    expect(isAnswersDirty(answers, baseline)).toBe(false)

    answers.overview.advisorNotes = 'Changed'
    expect(isAnswersDirty(answers, baseline)).toBe(true)
  })

  it('builds a full-document save payload and preserves unrelated sections', () => {
    const answers = answersFixture((a) => {
      a.income.noCurrentIncome = true
      a.income.notes = 'Keep me'
      a.assets.noAssets = true
      a.goals.noCurrentGoals = true
      a.meta.startedAt = '2026-07-01T00:00:00.000Z'
    })

    const document = buildAnswersDocumentForSave({
      answers,
      lastSection: 'insurance',
      completedSectionIds: ['income', 'assets'],
      now: () => new Date('2026-07-28T12:00:00.000Z'),
    })

    expect(document.meta.lastSection).toBe('insurance')
    expect(document.meta.lastSavedAt).toBe('2026-07-28T12:00:00.000Z')
    expect(document.meta.startedAt).toBe('2026-07-01T00:00:00.000Z')
    expect(document.meta.completedSections).toEqual(['income', 'assets'])
    expect(document.income.notes).toBe('Keep me')
    expect(document.assets.noAssets).toBe(true)
    expect(document.goals.noCurrentGoals).toBe(true)
    expect(document.insurance.coverages).toEqual([])

    const payload = answersToApiPayload(document)
    expect(payload.income).toMatchObject({ notes: 'Keep me', noCurrentIncome: true })
    expect(payload.goals).toMatchObject({ noCurrentGoals: true })
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        'meta',
        'overview',
        'members',
        'income',
        'cashFlow',
        'assets',
        'debts',
        'insurance',
        'retirement',
        'estate',
        'goals',
      ]),
    )
  })

  it('does not drop Phase 3 values when preparing a Phase 4 section save', () => {
    const answers = answersFixture((a) => {
      a.cashFlow.takeHomeIncomeCents = 250000
      a.cashFlow.housingCents = 120000
      a.debts.noDebts = true
      a.insurance.noCurrentCoverage = true
      a.insurance.protectionConcernsAcknowledged = true
    })

    const document = buildAnswersDocumentForSave({
      answers,
      lastSection: 'retirement',
      completedSectionIds: [],
      now: () => new Date('2026-07-28T15:00:00.000Z'),
    })

    expect(document.cashFlow.takeHomeIncomeCents).toBe(250000)
    expect(document.cashFlow.housingCents).toBe(120000)
    expect(document.debts.noDebts).toBe(true)
    expect(document.insurance.noCurrentCoverage).toBe(true)
    expect(document.meta.lastSection).toBe('retirement')
  })

  it('evaluates draft freshness for stale overwrite protection', () => {
    const fresh = evaluateDraftFreshness({
      loadedAssessmentId: 'draft-1',
      loadedUpdatedAt: '2026-07-28T10:00:00.000Z',
      latest: {
        id: 'draft-1',
        household_id: 'hh',
        assessment_type: 'household_onboarding',
        status: 'draft',
        completed_at: null,
        answers: {},
        derived_metrics: {},
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-28T10:00:00.000Z',
      },
    })
    expect(fresh).toEqual({ status: 'fresh' })

    const stale = evaluateDraftFreshness({
      loadedAssessmentId: 'draft-1',
      loadedUpdatedAt: '2026-07-28T10:00:00.000Z',
      latest: {
        id: 'draft-1',
        household_id: 'hh',
        assessment_type: 'household_onboarding',
        status: 'draft',
        completed_at: null,
        answers: {},
        derived_metrics: {},
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-28T11:00:00.000Z',
      },
    })
    expect(stale.status).toBe('stale')
    expect(describeDraftFreshnessFailure(stale)).toMatch(/updated elsewhere/i)

    expect(
      evaluateDraftFreshness({
        loadedAssessmentId: 'draft-1',
        loadedUpdatedAt: '2026-07-28T10:00:00.000Z',
        latest: null,
      }).status,
    ).toBe('missing')
  })

  it('keeps blank money null through save serialization', () => {
    const answers = answersFixture((a) => {
      a.cashFlow.takeHomeIncomeCents = null
      a.cashFlow.foodCents = 0
    })
    const document = buildAnswersDocumentForSave({
      answers,
      lastSection: 'cash-flow',
      completedSectionIds: [],
      now: () => new Date('2026-07-28T12:00:00.000Z'),
    })
    const payload = answersToApiPayload(document)
    expect((payload.cashFlow as { takeHomeIncomeCents: unknown }).takeHomeIncomeCents).toBeNull()
    expect((payload.cashFlow as { foodCents: unknown }).foodCents).toBe(0)
  })
})

describe('save API wiring contract', () => {
  it('documents that updates replace the full answers document only', async () => {
    const update = vi.fn(async (_sb, _id, _hh, input: { answers?: Record<string, unknown> }) => {
      expect(input.answers).toBeDefined()
      expect(input.answers?.income).toMatchObject({ notes: 'alpha' })
      expect(input.answers?.assets).toMatchObject({ noAssets: true })
      return {
        id: 'draft-1',
        household_id: 'hh',
        assessment_type: 'household_onboarding',
        status: 'draft',
        completed_at: null,
        answers: input.answers,
        derived_metrics: {},
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-28T12:00:00.000Z',
      }
    })

    const answers = answersFixture((a) => {
      a.income.notes = 'alpha'
      a.assets.noAssets = true
      a.retirement.planningStatus = 'early_planning'
    })
    const document = buildAnswersDocumentForSave({
      answers,
      lastSection: 'assets',
      completedSectionIds: ['assets'],
      now: () => new Date('2026-07-28T12:00:00.000Z'),
    })

    await update({}, 'draft-1', 'hh', { answers: answersToApiPayload(document) })
    expect(update).toHaveBeenCalledTimes(1)
  })
})
