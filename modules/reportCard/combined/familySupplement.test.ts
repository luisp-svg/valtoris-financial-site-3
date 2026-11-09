import { describe, expect, it } from 'vitest'
import { combinedQuestions, validateCombined, updateCombined } from './engine'
import { familyAreas } from './cardProfiles'
import { adaptiveReportCard } from './results'
import { sampleReportAnswers } from './samples'
import { specializedFunnels } from '../funnelStrategy'

describe('public report examples and family intake context', () => {
  it.each(specializedFunnels)('generates a valid fictional $id report', ({ selected }) => {
    const answers = sampleReportAnswers(selected, 'en')
    expect(validateCombined(answers)).not.toBeNull()
    expect(adaptiveReportCard(answers) || selected.includes('protection')).toBeTruthy()
  })
  it('preserves older family assessments and leaves report calculations unchanged', () => {
    const old = sampleReportAnswers(familyAreas, 'en')
    expect(validateCombined(old)).not.toBeNull()
    expect(combinedQuestions(familyAreas, {}, 1, 1, 1).some(q => q.id.startsWith('family_health'))).toBe(false)
    const diagnostic = { ...old.diagnostic, 'family_health.coverage': 'none', 'family_health.needs': 'multiple', 'family_health.cost_difficulty': 'yes', 'family_loans.has_loans': 'no' }
    const next = { ...old, familySupplementVersion: 1 as const, diagnostic }
    expect(validateCombined(next)).not.toBeNull()
    expect(adaptiveReportCard(next)).toEqual(adaptiveReportCard(old))
  })
  it('prunes loan details after no-loans selection and premiums after uninsured selection', () => {
    const original = { 'family_loans.has_loans': 'yes', 'family_loans.balance': '15000', 'family_health.coverage': 'all', 'family_health.premium': '300' }
    const noLoans = updateCombined(familyAreas, original, 'family_loans.has_loans', 'no', 1, 1, 1, 1)
    expect(noLoans).not.toHaveProperty('family_loans.balance')
    const uninsured = updateCombined(familyAreas, noLoans, 'family_health.coverage', 'none', 1, 1, 1, 1)
    expect(uninsured).not.toHaveProperty('family_health.premium')
  })
  it('rejects invalid extra answers and nonfamily supplements', () => {
    const answers = sampleReportAnswers(familyAreas, 'en')
    expect(validateCombined({ ...answers, familySupplementVersion: 1, diagnostic: { ...answers.diagnostic, 'family_health.coverage': 'invalid' } })).toBeNull()
    expect(validateCombined({ ...sampleReportAnswers(['credit'], 'en'), familySupplementVersion: 1 })).toBeNull()
  })
})
