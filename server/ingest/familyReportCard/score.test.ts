import { describe, expect, it } from 'vitest'
import { scoreBusinessAssessment } from '../../../components/assessment/scoring/scoreBusinessAssessment'
import { scoreFamilyAssessment } from '../../../components/assessment/scoring/scoreFamilyAssessment'
import { scoreRetirementAssessment } from '../../../components/assessment/scoring/scoreRetirementAssessment'
import {
  STRONG_BUSINESS_PROFILE,
  WEAK_BUSINESS_PROFILE,
} from '../../../components/assessment/scoring/scoreBusinessAssessment.test'
import {
  ALREADY_RETIRED_PROFILE,
  INCOME_GAP_RETIREMENT_PROFILE,
  STRONG_RETIREMENT_PROFILE,
} from '../../../components/assessment/scoring/scoreRetirementAssessment.test'
import { DEMO_BUSINESS_ANSWERS } from '../../../components/reportCard/businessReportCardData'
import { DEMO_RETIREMENT_ANSWERS } from '../../../components/reportCard/retirementReportCardData'
import {
  compareClientScore,
  recalculateBusinessReportCardScore,
  recalculateFamilyReportCardScore,
  recalculateProtectionGapResult,
  recalculateRetirementReportCardScore,
} from './score'
import { FAMILY_REPORT_CARD_SCORING_VERSION } from './types'
import { validFamilyAnswersFixture, validProtectionAnswersFixture } from './testFixtures'

function expectBusinessParity(answers: typeof DEMO_BUSINESS_ANSWERS) {
  const browser = scoreBusinessAssessment(answers)
  const server = recalculateBusinessReportCardScore(answers)
  expect(server.overallScore).toBe(browser.overallScore)
  expect(server.overallGrade).toBe(browser.overallGrade)
  expect(server.currentLevel).toBe(browser.currentLevel)
  expect(server.categories.map((c) => [c.id, c.score, c.grade])).toEqual(
    browser.categories.map((c) => [c.id, c.score, c.grade]),
  )
  expect(server.priorities.map((p) => [p.level, p.title, p.why, p.timeline])).toEqual(
    browser.priorities.map((p) => [p.level, p.title, p.why, p.timeline]),
  )
  expect(server.extraDerived).toEqual({
    growthReadiness: browser.growthReadiness,
    protectionRating: browser.protectionRating,
  })
}

function expectRetirementParity(answers: typeof DEMO_RETIREMENT_ANSWERS) {
  const browser = scoreRetirementAssessment(answers)
  const server = recalculateRetirementReportCardScore(answers)
  expect(server.overallScore).toBe(browser.overallScore)
  expect(server.overallGrade).toBe(browser.overallGrade)
  expect(server.currentLevel).toBe(browser.currentLevel)
  expect(server.categories.map((c) => [c.id, c.score, c.grade])).toEqual(
    browser.categories.map((c) => [c.id, c.score, c.grade]),
  )
  expect(server.priorities.map((p) => [p.level, p.title, p.why, p.timeline])).toEqual(
    browser.priorities.map((p) => [p.level, p.title, p.why, p.timeline]),
  )
  expect(server.extraDerived?.metrics).toMatchObject({
    annualIncomeGap: browser.metrics.annualIncomeGap,
    targetAnnualRetirementSpending: browser.metrics.targetAnnualRetirementSpending,
    totalProjectedMonthlyIncome: browser.metrics.totalProjectedMonthlyIncome,
    nestEggGap: browser.metrics.nestEggGap,
    currentAge: browser.metrics.currentAge,
    retirementAge: browser.metrics.retirementAge,
    isAlreadyRetired: browser.metrics.isAlreadyRetired,
  })
}

describe('recalculateFamilyReportCardScore', () => {
  it('matches the browser scoring path exactly (same pure engine, same inputs)', () => {
    const answers = validFamilyAnswersFixture()
    const browserResult = scoreFamilyAssessment(answers)
    const serverResult = recalculateFamilyReportCardScore(answers)

    expect(serverResult.overallScore).toBe(browserResult.overallScore)
    expect(serverResult.overallGrade).toBe(browserResult.overallGrade)
    expect(serverResult.protectionGapAmount).toBe(browserResult.protectionGapAmount)
    expect(serverResult.categories.map((c) => c.score)).toEqual(
      browserResult.categories.map((c) => c.score),
    )
    expect(serverResult.priorities.map((p) => p.title)).toEqual(
      browserResult.priorities.map((p) => p.title),
    )
  })

  it('stamps the current scoring version', () => {
    const result = recalculateFamilyReportCardScore(validFamilyAnswersFixture())
    expect(result.scoringVersion).toBe(FAMILY_REPORT_CARD_SCORING_VERSION)
  })

  it('is deterministic for identical input', () => {
    const answers = validFamilyAnswersFixture()
    const first = recalculateFamilyReportCardScore(answers)
    const second = recalculateFamilyReportCardScore(answers)
    expect(first).toEqual(second)
  })
})

describe('compareClientScore', () => {
  it('flags no mismatch when the client score/grade agree with the server', () => {
    const server = { overallScore: 78, overallGrade: 'C+' }
    const result = compareClientScore({ clientReportedScore: 78, clientReportedGrade: 'C+', server })
    expect(result.scoreMismatch).toBe(false)
    expect(result.serverCalculatedScore).toBe(78)
    expect(result.serverCalculatedGrade).toBe('C+')
  })

  it('flags a mismatch when the client score differs by 1 or more points', () => {
    const server = { overallScore: 78, overallGrade: 'C+' }
    const result = compareClientScore({ clientReportedScore: 95, clientReportedGrade: 'C+', server })
    expect(result.scoreMismatch).toBe(true)
    expect(result.clientReportedScore).toBe(95)
  })

  it('flags a mismatch when only the grade differs', () => {
    const server = { overallScore: 78, overallGrade: 'C+' }
    const result = compareClientScore({ clientReportedScore: 78, clientReportedGrade: 'A', server })
    expect(result.scoreMismatch).toBe(true)
  })

  it('is never authoritative — a manipulated client score never overrides the server value', () => {
    const server = { overallScore: 42, overallGrade: 'F' }
    const result = compareClientScore({ clientReportedScore: 100, clientReportedGrade: 'A', server })
    expect(result.serverCalculatedScore).toBe(42)
    expect(result.serverCalculatedGrade).toBe('F')
    expect(result.scoreMismatch).toBe(true)
  })

  it('treats a missing client score/grade as no mismatch', () => {
    const server = { overallScore: 60, overallGrade: 'D' }
    const result = compareClientScore({ server })
    expect(result.scoreMismatch).toBe(false)
    expect(result.clientReportedScore).toBeNull()
    expect(result.clientReportedGrade).toBeNull()
  })
})

describe('recalculateBusinessReportCardScore', () => {
  it('matches the browser scoring path for the demo fixture', () => {
    expectBusinessParity(DEMO_BUSINESS_ANSWERS)
  })

  it('matches the browser scoring path for weak and strong boundary profiles', () => {
    expectBusinessParity(WEAK_BUSINESS_PROFILE)
    expectBusinessParity(STRONG_BUSINESS_PROFILE)
  })
})

describe('recalculateRetirementReportCardScore', () => {
  it('matches the browser scoring path for the demo fixture', () => {
    expectRetirementParity(DEMO_RETIREMENT_ANSWERS)
  })

  it('matches the browser scoring path for strong, income-gap, and already-retired profiles', () => {
    expectRetirementParity(STRONG_RETIREMENT_PROFILE)
    expectRetirementParity(INCOME_GAP_RETIREMENT_PROFILE)
    expectRetirementParity(ALREADY_RETIRED_PROFILE)
  })
})

describe('recalculateProtectionGapResult', () => {
  it('never invents a score or grade', () => {
    const result = recalculateProtectionGapResult(validProtectionAnswersFixture())
    expect(result.overallScore).toBeNull()
    expect(result.overallGrade).toBeNull()
    expect(typeof result.netProtectionGap).toBe('number')
    expect(result.currentProtection).toBe(250000)
    expect(result.totalNeed).toBeGreaterThan(0)
  })
})
