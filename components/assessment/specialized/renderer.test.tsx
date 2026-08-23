import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveSpecializedCopy } from './locale'
import SpecializedQuestionRenderer from './renderer'
import type { SpecializedAnswerMap, SpecializedQuestion } from './types'
import { studentLoanCopy } from '../studentLoan/copy'
import { STUDENT_LOAN_QUESTIONS } from '../studentLoan/questions'

function t(section: 'questions' | 'helpers' | 'fields' | 'answers' | 'placeholders' | 'validation' | 'ui' | 'results', key: string) {
  return resolveSpecializedCopy(studentLoanCopy, 'en', section, key)
}

function renderQuestion(question: SpecializedQuestion, values: SpecializedAnswerMap, showErrors = false) {
  return renderToStaticMarkup(
    createElement(SpecializedQuestionRenderer, {
      question,
      values,
      t,
      showErrors,
      onChange: () => undefined,
    }),
  )
}

function question(id: string): SpecializedQuestion {
  const found = STUDENT_LOAN_QUESTIONS.find((item) => item.id === id)
  if (!found) throw new Error(`Missing question ${id}`)
  return found
}

describe('specialized question renderer', () => {
  it('renders single-select options from locale labels, not canonical values as labels', () => {
    const html = renderQuestion(question('total_balance'), { total_balance: '' })
    expect(html).toContain('What is your approximate total student loan balance?')
    expect(html).toContain('Under $25,000')
    expect(html).toContain('value="under_25k"')
    expect(html).not.toContain('>under_25k<')
    expect(html).toContain('<select')
  })

  it('renders multi-select choices', () => {
    const html = renderQuestion(question('loan_types'), { loan_types: ['direct'] })
    expect(html).toContain('Federal Direct Loan')
    expect(html).toContain('choice-group')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Parent PLUS')
  })

  it('renders short-text with a bounded max length', () => {
    const html = renderQuestion(question('loan_servicer'), {
      servicer_mode: 'named',
      servicer_name: 'MOHELA',
    })
    expect(html).toContain('type="text"')
    expect(html).toContain('maxlength="80"')
    expect(html).toContain('Servicer name')
    expect(html).toContain('name="servicer_name"')
    expect(html).not.toContain('name="ssn"')
    expect(html).not.toContain('name="account_number"')
  })

  it('renders grouped fields together as one question card', () => {
    const html = renderQuestion(question('income_household'), { income: '', household_size: '' })
    expect(html).toContain('What is your income and household size?')
    expect(html).toContain('Approximate annual income')
    expect(html).toContain('Household size')
    expect(html.match(/<select/g)?.length).toBe(2)
  })

  it('hides conditional follow-ups until the parent value matches', () => {
    const hidden = renderQuestion(question('repayment_plan'), { knows_plan: 'no', current_plan: '' })
    expect(hidden).toContain('What repayment plan are you on, if you know it?')
    expect(hidden).not.toContain('Current or recent repayment plan')
    expect(hidden).not.toContain('SAVE')

    const shown = renderQuestion(question('repayment_plan'), { knows_plan: 'yes', current_plan: '' })
    expect(shown).toContain('Current or recent repayment plan')
    expect(shown).toContain('Repayment Assistance Plan (RAP)')
    expect(shown).toContain('Tiered Standard')
    expect(shown).toContain('SAVE (legacy / transitioning)')
    expect(shown).toContain('REPAYE (legacy plan)')
    expect(shown).toContain('value="rap"')
    expect(shown).toContain('value="tiered_standard"')
    expect(shown).toContain('value="save"')
    expect(shown).not.toMatch(/enroll in SAVE|apply for SAVE|available SAVE/i)
  })

  it('exposes validation state without scoring copy', () => {
    const html = renderQuestion(question('loan_status'), { loan_status: '' }, true)
    expect(html).toContain('This field is required.')
    expect(html).not.toContain('Health Score')
    expect(html).not.toContain('grade')
  })
})
