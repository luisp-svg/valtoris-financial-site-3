import { describe, expect, it } from 'vitest'
import { scoreFamilyAssessment } from '../../../components/assessment/scoring/scoreFamilyAssessment'
import { compareClientScore, recalculateFamilyReportCardScore } from './score'
import { FAMILY_REPORT_CARD_SCORING_VERSION } from './types'
import { validFamilyAnswersFixture } from './testFixtures'

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
