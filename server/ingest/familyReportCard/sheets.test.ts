import { describe, expect, it, vi } from 'vitest'
import { recalculateFamilyReportCardScore } from './score'
import { buildFamilyReportCardSheetsPayload, writeFamilyReportCardToSheets } from './sheets'
import { validFamilyAnswersFixture } from './testFixtures'

function makeSheetsPayload() {
  const answers = validFamilyAnswersFixture()
  const score = recalculateFamilyReportCardScore(answers)
  return buildFamilyReportCardSheetsPayload({ answers, score, sourcePage: '/family-report-card' })
}

describe('buildFamilyReportCardSheetsPayload', () => {
  it('uses the server-calculated score, not any client-reported value', () => {
    const answers = validFamilyAnswersFixture()
    const score = recalculateFamilyReportCardScore(answers)
    const payload = buildFamilyReportCardSheetsPayload({ answers, score, sourcePage: '/x' })

    expect(payload.overallScore).toBe(score.overallScore)
    expect(payload.overallGrade).toBe(score.overallGrade)
    expect(payload.firstName).toBe('Jamie')
    expect(payload.lastName).toBe('Rivera')
    expect(payload.sourcePage).toBe('/x')
  })
})

describe('writeFamilyReportCardToSheets', () => {
  it('skips with not_configured when no webhook URL is available', async () => {
    const result = await writeFamilyReportCardToSheets(makeSheetsPayload(), { webhookUrl: '' })
    expect(result.status).toBe('skipped')
    expect(result.errorCategory).toBe('not_configured')
  })

  it('returns succeeded on a 2xx response and extracts an external ref when present', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ rowRef: 'row-123' }),
    })

    const result = await writeFamilyReportCardToSheets(makeSheetsPayload(), {
      webhookUrl: 'https://example.com/webhook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.status).toBe('succeeded')
    expect(result.externalRef).toBe('row-123')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toContain('text/plain')
    const body = JSON.parse(init.body)
    expect(body.leadType).toBe('Family Report Card')
  })

  it('returns http_error on a non-2xx response without leaking the response body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal secret stack trace',
    })

    const result = await writeFamilyReportCardToSheets(makeSheetsPayload(), {
      webhookUrl: 'https://example.com/webhook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.status).toBe('failed')
    expect(result.errorCategory).toBe('http_error')
    expect(JSON.stringify(result)).not.toContain('Internal secret stack trace')
  })

  it('returns network_error when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

    const result = await writeFamilyReportCardToSheets(makeSheetsPayload(), {
      webhookUrl: 'https://example.com/webhook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.status).toBe('failed')
    expect(result.errorCategory).toBe('network_error')
  })

  it('returns timeout when the request is aborted', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    })

    const result = await writeFamilyReportCardToSheets(makeSheetsPayload(), {
      webhookUrl: 'https://example.com/webhook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 5,
    })

    expect(result.status).toBe('failed')
    expect(result.errorCategory).toBe('timeout')
  })

  it('makes only a single attempt (no retry loop) on failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))

    await writeFamilyReportCardToSheets(makeSheetsPayload(), {
      webhookUrl: 'https://example.com/webhook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
