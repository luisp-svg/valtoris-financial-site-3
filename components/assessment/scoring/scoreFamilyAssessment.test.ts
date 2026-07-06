import { describe, expect, it } from 'vitest'
import { DemoAssessmentAnswers, INITIAL_DEMO_ANSWERS } from '../types'
import { scoreFamilyAssessment } from './scoreFamilyAssessment'

function buildAnswers(overrides: Partial<DemoAssessmentAnswers>): DemoAssessmentAnswers {
  return {
    family: { ...INITIAL_DEMO_ANSWERS.family, ...overrides.family },
    financial: { ...INITIAL_DEMO_ANSWERS.financial, ...overrides.financial },
    protection: { ...INITIAL_DEMO_ANSWERS.protection, ...overrides.protection },
    goals: { ...INITIAL_DEMO_ANSWERS.goals, ...overrides.goals },
  }
}

export const WEAK_FAMILY_PROFILE: DemoAssessmentAnswers = buildAnswers({
  family: {
    firstName: 'Weak',
    lastName: 'Profile',
    email: 'weak@example.com',
    phone: '5551112222',
    age: '42',
    state: 'TX',
    maritalStatus: 'married',
    numberOfChildren: '2',
  },
  financial: {
    householdIncome: '80000',
    monthlyHousingPayment: '2800',
    totalDebt: '120000',
    emergencyFundMonths: '0',
    monthlyCashFlow: 'overspend',
    retirementContribution: 'not-saving',
  },
  protection: {
    currentLifeInsurance: '50000',
    hasDisabilityProtection: 'no',
    hasWill: 'no',
    hasTrust: 'no',
    beneficiariesReviewed: 'no',
    guardianDocumented: 'no',
  },
  goals: {
    selected: ['protect-family', 'debt-free'],
  },
})

export const AVERAGE_FAMILY_PROFILE: DemoAssessmentAnswers = buildAnswers({
  family: {
    firstName: 'Average',
    lastName: 'Profile',
    email: 'average@example.com',
    phone: '5553334444',
    age: '38',
    state: 'CA',
    maritalStatus: 'married',
    numberOfChildren: '1',
  },
  financial: {
    householdIncome: '120000',
    monthlyHousingPayment: '2200',
    totalDebt: '45000',
    emergencyFundMonths: '4',
    monthlyCashFlow: 'break-even',
    retirementContribution: '3-5',
  },
  protection: {
    currentLifeInsurance: '350000',
    hasDisabilityProtection: 'no',
    hasWill: 'yes',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    guardianDocumented: 'no',
  },
  goals: {
    selected: ['retire', 'protect-family'],
  },
})

export const STRONG_FAMILY_PROFILE: DemoAssessmentAnswers = buildAnswers({
  family: {
    firstName: 'Strong',
    lastName: 'Profile',
    email: 'strong@example.com',
    phone: '5555556666',
    age: '45',
    state: 'FL',
    maritalStatus: 'married',
    numberOfChildren: '0',
  },
  financial: {
    householdIncome: '180000',
    monthlyHousingPayment: '2500',
    totalDebt: '15000',
    emergencyFundMonths: '9',
    monthlyCashFlow: 'save-most-months',
    retirementContribution: 'over-15',
  },
  protection: {
    currentLifeInsurance: '1500000',
    hasDisabilityProtection: 'yes',
    hasWill: 'yes',
    hasTrust: 'yes',
    beneficiariesReviewed: 'yes',
    guardianDocumented: '',
  },
  goals: {
    selected: ['build-wealth', 'legacy'],
  },
})

describe('scoreFamilyAssessment profiles', () => {
  it('produces clearly different overall scores for weak, average, and strong profiles', () => {
    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const average = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)

    expect(weak.overallScore).toBeLessThan(average.overallScore)
    expect(average.overallScore).toBeLessThan(strong.overallScore)

    expect(weak.overallScore).toBeLessThan(60)
    expect(strong.overallScore).toBeGreaterThan(80)
    expect(strong.overallScore - weak.overallScore).toBeGreaterThanOrEqual(25)
  })

  it('produces different grades and current levels across profiles', () => {
    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const average = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)

    expect(weak.overallGrade).not.toBe(strong.overallGrade)
    expect(average.overallGrade).not.toBe(strong.overallGrade)
    expect(weak.currentLevel).toBe('Needs Immediate Attention')
    expect(strong.currentLevel).not.toBe(weak.currentLevel)
  })

  it('produces different category scores and priorities across profiles', () => {
    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const average = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)

    const weakProtection = weak.categories.find((c) => c.id === 'protection')!.score
    const strongProtection = strong.categories.find((c) => c.id === 'protection')!.score
    expect(weakProtection).toBeLessThan(strongProtection)

    expect(weak.priorities[0]?.title).not.toBe(strong.priorities[0]?.title)
    expect(weak.priorities.map((p) => p.title)).not.toEqual(average.priorities.map((p) => p.title))
    expect(strong.priorities.map((p) => p.title)).not.toEqual(weak.priorities.map((p) => p.title))
  })

  it('produces different action plans and recommendations across profiles', () => {
    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)

    expect(weak.actionPlan.immediate).not.toEqual(strong.actionPlan.immediate)
    expect(weak.categories[0].recommendations).not.toEqual(strong.categories[0].recommendations)
    expect(weak.blueprintBullets[0]).not.toBe(strong.blueprintBullets[0])
  })

  it('calculates protection gap from collected answers without hardcoded values', () => {
    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)

    expect(weak.protectionGapAmount).toBeGreaterThan(strong.protectionGapAmount)
    expect(weak.protectionGapFormatted).not.toBe('$750,000')
    expect(weak.protectionGapFormatted.startsWith('$')).toBe(true)
  })

  it('is deterministic for identical answers', () => {
    const first = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)
    const second = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)

    expect(first).toEqual(second)
  })
})
