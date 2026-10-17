import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { shouldNoIndex, standaloneCanonical } from './routeIndexing'

describe('organic entry pages and personal result indexing', () => {
  it.each(['/tsp-report-card', '/health-insurance-report-card', '/student-loan-report-card', '/report-card', '/business-report-card', '/home-buyer-report-card', '/schedule'])('keeps %s discoverable', path => {
    expect(shouldNoIndex(path)).toBe(false)
  })
  it.each(['/results', '/business-results', '/retirement-results', '/student-loan-results', '/credit-results', '/home-buyer-results', '/protection-results', '/results/', '/crm', '/crm/login', '/api/lead', '/preview/report-cards/family'])('excludes %s from indexing', path => {
    expect(shouldNoIndex(path)).toBe(true)
  })
  it('matches internal path boundaries without excluding unrelated public paths', () => {
    expect(shouldNoIndex('/crm-training')).toBe(false)
    expect(shouldNoIndex('/previewing')).toBe(false)
  })
  it('gives standalone entry pages clean, locale-specific canonicals', () => {
    expect(standaloneCanonical('/schedule', 'en')).toBe('https://www.valtorisfinancial.com/schedule')
    expect(standaloneCanonical('/student-loan-assessment', 'es')).toBe('https://www.valtorisfinancial.com/student-loan-assessment?lang=es')
    expect(standaloneCanonical('/results', 'en')).toBeNull()
    expect(standaloneCanonical('/tsp-report-card', 'en')).toBeNull()
  })
  it('also protects result responses before JavaScript runs without excluding funnel entry pages', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    for (const path of ['/results', '/business-results', '/retirement-results', '/student-loan-results', '/credit-results', '/home-buyer-results', '/protection-results']) {
      expect(config.headers.find(rule => rule.source === path)?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
    }
    expect(config.headers.some(rule => rule.source === '/:path*' || rule.source === '/(.*)')).toBe(false)
    for (const path of ['/tsp-report-card', '/health-insurance-report-card', '/student-loan-report-card', '/report-card', '/business-report-card', '/home-buyer-report-card']) {
      expect(config.headers.some(rule => rule.source === path)).toBe(false)
    }
  })
})
