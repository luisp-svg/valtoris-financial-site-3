import { describe, expect, it } from 'vitest'
import {
  applyFieldChange,
  applyExclusiveMultiValue,
  assertSpecializedQuestion,
  conditionMatches,
  isQuestionComplete,
  planSpecializedQuestionRender,
} from './answers'
import { readSpecializedLocale, resolveSpecializedCopy } from './locale'
import type { SpecializedQuestion } from './types'
import { SPECIALIZED_LOCALES, SPECIALIZED_QUESTION_KINDS } from './types'
import { studentLoanCopy } from '../studentLoan/copy'
import { STUDENT_LOAN_QUESTIONS } from '../studentLoan/questions'

const followUpQuestion: SpecializedQuestion = {
  id: 'demo_group',
  kind: 'group',
  diagnostic: true,
  labelKey: 'demo',
  fields: [
    {
      id: 'parent',
      input: 'single',
      labelKey: 'parent',
      options: [
        { value: 'yes', labelKey: 'yes' },
        { value: 'no', labelKey: 'no' },
      ],
    },
    {
      id: 'child',
      input: 'short_text',
      labelKey: 'child',
      maxLength: 20,
      when: { field: 'parent', equals: 'yes' },
    },
  ],
}

describe('specialized question contract', () => {
  it('supports the explicit question kinds', () => {
    expect(SPECIALIZED_QUESTION_KINDS).toEqual(['single', 'multi', 'short_text', 'group'])
    expect(SPECIALIZED_LOCALES).toEqual(['en', 'es'])
  })

  it('treats a group as one diagnostic question', () => {
    expect(followUpQuestion.diagnostic).toBe(true)
    expect(followUpQuestion.kind).toBe('group')
    expect(followUpQuestion.fields.length).toBeGreaterThan(1)
    assertSpecializedQuestion(followUpQuestion)
  })

  it('keeps follow-up visibility deterministic', () => {
    expect(conditionMatches({ field: 'parent', equals: 'yes' }, { parent: 'yes' })).toBe(true)
    expect(conditionMatches({ field: 'parent', equals: 'yes' }, { parent: 'no' })).toBe(false)
    expect(planSpecializedQuestionRender(followUpQuestion, { parent: 'no', child: '' })).toEqual([
      { id: 'parent', input: 'single', followUp: false, required: true },
    ])
    expect(planSpecializedQuestionRender(followUpQuestion, { parent: 'yes', child: '' })).toEqual([
      { id: 'parent', input: 'single', followUp: false, required: true },
      { id: 'child', input: 'short_text', followUp: true, required: true },
    ])
  })

  it('clears hidden follow-up values when the parent changes', () => {
    const hidden = applyFieldChange(followUpQuestion, followUpQuestion.fields[0], {
      parent: 'yes',
      child: 'MOHELA',
    }, 'no')
    expect(hidden).toEqual({ parent: 'no', child: '' })
  })

  it('requires visible grouped fields before the question is complete', () => {
    expect(isQuestionComplete(followUpQuestion, { parent: 'no', child: '' })).toBe(true)
    expect(isQuestionComplete(followUpQuestion, { parent: 'yes', child: '' })).toBe(false)
    expect(isQuestionComplete(followUpQuestion, { parent: 'yes', child: 'MOHELA' })).toBe(true)
  })

  it('applies exclusive multi-select values deterministically', () => {
    const field = STUDENT_LOAN_QUESTIONS.find((question) => question.id === 'previous_actions')!.fields[0]
    expect(field.input).toBe('multi')
    if (field.input !== 'multi') return
    expect(applyExclusiveMultiValue(field, ['idr'], ['idr', 'none'])).toEqual(['none'])
    expect(applyExclusiveMultiValue(field, ['none'], ['none', 'pslf'])).toEqual(['pslf'])
  })

  it('keeps locale labels separate from canonical values', () => {
    expect(readSpecializedLocale('?lang=es')).toBe('es')
    expect(readSpecializedLocale('?locale=en')).toBe('en')
    expect(readSpecializedLocale('')).toBe('en')
    const directLabel = resolveSpecializedCopy(studentLoanCopy, 'en', 'answers', 'loan_types.direct')
    expect(directLabel).toBe('Federal Direct Loan')
    expect(directLabel).not.toBe('direct')
    const spanishLabel = resolveSpecializedCopy(studentLoanCopy, 'es', 'answers', 'loan_types.direct')
    expect(spanishLabel).toBe('Préstamo Directo Federal')
    expect(spanishLabel).not.toBe(directLabel)
    expect(studentLoanCopy.es).not.toBeNull()
  })

  it('validates every Student Loan question against the contract', () => {
    for (const question of STUDENT_LOAN_QUESTIONS) {
      assertSpecializedQuestion(question)
      expect(question.diagnostic).toBe(true)
    }
  })
})
