import { afterEach, expect, it, vi } from 'vitest'
import { requestAssessmentReport } from './requestAssessmentReport'
const url = '/api/ingest-family-report-card?flow=premium&action=report&assessment=test'
afterEach(() => vi.useRealTimers())
it('recovers from one temporary server failure without changing booking authorization', async () => {
  vi.useFakeTimers()
  const locked = new Response(JSON.stringify({ ok: false, code: 'booking_required' }), { status: 423 })
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(locked)
  const result = requestAssessmentReport(url, fetcher)
  await vi.advanceTimersByTimeAsync(300)
  expect(await result).toBe(locked)
  expect(fetcher).toHaveBeenCalledTimes(2)
  for (const [requested, options] of fetcher.mock.calls) {
    expect(requested).toBe(url)
    expect(options).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' })
    expect(options?.body).toBeUndefined()
  }
})
it('retries a transport timeout once', async () => {
  vi.useFakeTimers()
  const response = new Response('{}')
  const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError')).mockResolvedValueOnce(response)
  const result = requestAssessmentReport(url, fetcher)
  await vi.advanceTimersByTimeAsync(300)
  expect(await result).toBe(response)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it.each([401, 404, 409, 423, 429])('does not retry authorization, booking or rate-limit status %i', async status => {
  const response = new Response('{}', { status })
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
  expect(await requestAssessmentReport(url, fetcher)).toBe(response)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('returns the final server failure after one retry', async () => {
  vi.useFakeTimers()
  const response = new Response('{}', { status: 503 })
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
  const result = requestAssessmentReport(url, fetcher)
  await vi.advanceTimersByTimeAsync(300)
  expect(await result).toBe(response)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
