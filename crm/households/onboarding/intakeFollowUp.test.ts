import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { INTAKE_FOLLOW_UP_GROUPS, normalizeIntakeFollowUp, type IntakeFollowUpAnswers } from './intakeFollowUp'
import { normalizeOnboardingAnswers } from './onboardingSchema'
import { answersToApiPayload, buildAnswersDocumentForSave, isAnswersDirty, serializeAnswersBaseline } from './onboardingPersistence'
import { completeFormAnswersFixture, householdFixture } from './testFixtures'
import { validateOnboardingCompletion } from './onboardingCompletion'
import IntakeFollowUpFields from './sections/IntakeFollowUpFields'

describe('private intake follow-up', () => {
  it('round-trips every deferred field through save and reload without changing shared intake', () => {
    const answers = completeFormAnswersFixture()
    const baseline = serializeAnswersBaseline(answers)
    const values: IntakeFollowUpAnswers = {}
    for (const group of INTAKE_FOLLOW_UP_GROUPS) for (const field of group.fields) values[field.id] = `Recorded: ${field.label}`
    answers.followUp = values
    expect(isAnswersDirty(answers, baseline)).toBe(true)
    const saved = buildAnswersDocumentForSave({ answers, lastSection: 'retirement', completedSectionIds: ['overview'], now: () => new Date('2026-09-26T12:00:00Z') })
    const restored = normalizeOnboardingAnswers(answersToApiPayload(saved))
    expect(restored.followUp).toEqual(values)
    expect(restored.income).toEqual(answers.income)
    expect(restored.assets).toEqual(answers.assets)
    expect(restored.debts).toEqual(answers.debts)
    expect(restored.retirement).toEqual(answers.retirement)
    expect(isAnswersDirty(restored, serializeAnswersBaseline(saved))).toBe(false)
  })

  it('does not change legacy completion or require unrelated follow-up topics', () => {
    const answers = completeFormAnswersFixture()
    const household = householdFixture()
    const original = validateOnboardingCompletion(answers, { household })
    expect(normalizeOnboardingAnswers(answers).followUp).toBeUndefined()
    answers.followUp = { business_name: 'Example', retirement_roth: 'Unknown' }
    expect(validateOnboardingCompletion(answers, { household })).toEqual(original)
  })

  it('keeps unknown distinct from zero, drops deleted fields and rejects unexpected keys/types', () => {
    expect(normalizeIntakeFollowUp({ home_purchase_funds: '0', retirement_pension: 'unknown', student_servicer: '', secret: 'no', credit_account_count: 9 })).toEqual({ home_purchase_funds: '0', retirement_pension: 'unknown' })
    expect(normalizeIntakeFollowUp({ student_servicer: 'a'.repeat(800) }).student_servicer).toHaveLength(500)
    expect(normalizeIntakeFollowUp(null)).toEqual({})
  })

  it('shows fields only in their mapped section and completed answers read-only in review', () => {
    const income = renderToStaticMarkup(createElement(IntakeFollowUpFields, { sectionId: 'income', answers: {}, readOnly: false, onChange: () => {} }))
    expect(income).toContain('name="business_name"')
    expect(income).not.toContain('name="credit_account_count"')
    const review = renderToStaticMarkup(createElement(IntakeFollowUpFields, { sectionId: 'review', answers: { student_servicer: '<script>test</script>' }, readOnly: true }))
    expect(review).toContain('&lt;script&gt;test&lt;/script&gt;')
    expect(review).not.toContain('<textarea')
    expect(review).not.toContain('Business details')
    const readonly = renderToStaticMarkup(createElement(IntakeFollowUpFields, { sectionId: 'retirement', answers: {}, readOnly: true }))
    expect(readonly).not.toContain('<textarea')
  })

  it('has one unique persistence key for each follow-up field', () => {
    const ids = INTAKE_FOLLOW_UP_GROUPS.flatMap(group => group.fields.map(field => field.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
