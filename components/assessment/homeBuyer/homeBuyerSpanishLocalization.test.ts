import { describe, expect, it } from 'vitest'
import { resolveSpecializedCopy } from '../specialized/locale'
import type { SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import { homeBuyerCopy } from './copy'
import { HOME_BUYER_QUESTIONS } from './questions'
import { HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT } from './constants'
import { creditCopy } from '../credit/copy'
import { studentLoanCopy } from '../studentLoan/copy'

function catalogKeys(catalog: SpecializedCopyCatalog): Record<string, string[]> {
  return {
    questions: Object.keys(catalog.questions).sort(),
    helpers: Object.keys(catalog.helpers).sort(),
    fields: Object.keys(catalog.fields).sort(),
    answers: Object.keys(catalog.answers).sort(),
    placeholders: Object.keys(catalog.placeholders).sort(),
    validation: Object.keys(catalog.validation).sort(),
    ui: Object.keys(catalog.ui).sort(),
    results: Object.keys(catalog.results).sort(),
  }
}

function t(locale: 'en' | 'es', section: SpecializedCopySection, key: string): string {
  return resolveSpecializedCopy(homeBuyerCopy, locale, section, key)
}

describe('Home Buyer Spanish localization', () => {
  it('keeps EN and ES catalogs key-complete against each other', () => {
    expect(homeBuyerCopy.en).toBeTruthy()
    expect(homeBuyerCopy.es).toBeTruthy()
    expect(catalogKeys(homeBuyerCopy.es!)).toEqual(catalogKeys(homeBuyerCopy.en!))
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
  })

  it('resolves every question, field, and answer key in both locales', () => {
    for (const question of HOME_BUYER_QUESTIONS) {
      expect(t('en', 'questions', question.labelKey)).not.toBe(question.labelKey)
      expect(t('es', 'questions', question.labelKey)).not.toBe(question.labelKey)
      expect(t('es', 'questions', question.labelKey)).not.toBe(t('en', 'questions', question.labelKey))
      if (question.helperKey) {
        expect(t('en', 'helpers', question.helperKey)).not.toBe(question.helperKey)
        expect(t('es', 'helpers', question.helperKey)).not.toBe(question.helperKey)
      }
      for (const field of question.fields) {
        expect(t('en', 'fields', field.labelKey)).not.toBe(field.labelKey)
        expect(t('es', 'fields', field.labelKey)).not.toBe(field.labelKey)
        if (field.input === 'short_text') continue
        for (const option of field.options) {
          expect(t('en', 'answers', option.labelKey)).not.toBe(option.labelKey)
          expect(t('es', 'answers', option.labelKey)).not.toBe(option.labelKey)
        }
      }
    }
  })

  it('does not change Credit or Student Loan copy catalogs', () => {
    expect(creditCopy.es).toBeTruthy()
    expect(studentLoanCopy.es).toBeTruthy()
    expect(catalogKeys(creditCopy.es!)).toEqual(catalogKeys(creditCopy.en!))
    expect(catalogKeys(studentLoanCopy.es!)).toEqual(catalogKeys(studentLoanCopy.en!))
  })
})
