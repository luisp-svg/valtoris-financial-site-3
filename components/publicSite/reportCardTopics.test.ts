import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ShortLanding from '../reportCard/shortForm/ShortLanding'
import { REVIEW_TOPICS } from './reportCardTopics'
import { TOOLS_NAV_LINKS } from './navConfig'
import { ROUTES } from '../../constants/routes'
function render(type: 'family' | 'business' | 'credit', path: string) {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try { return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ShortLanding, { assessmentType: type }))) } finally { quiet.mockRestore() }
}
describe('Family and Business topic navigation', () => {
  it('limits the public tool menu to the two hubs while preserving focused assessment destinations', () => {
    expect(TOOLS_NAV_LINKS.map(link => link.to)).toEqual([ROUTES.reportCard, ROUTES.businessReportCard])
    expect(REVIEW_TOPICS.family.find(topic => topic.id === 'credit')?.to).toBe(ROUTES.creditAssessment)
    expect(REVIEW_TOPICS.family.find(topic => topic.id === 'retirement')?.to).toBe(ROUTES.retirementAssessment)
    expect(REVIEW_TOPICS.family.find(topic => topic.id === 'pc')?.to).toBe(ROUTES.getQuote)
    expect(REVIEW_TOPICS.business.find(topic => topic.id === 'pc')?.to).toBe('/commercial-quote')
  })
  it('renders the actual Family landing with topic choices and keeps language and campaign attribution on links', () => {
    const html = render('family', '/report-card?lang=es&utm_source=advisor&card=abc')
    expect(html).toContain('¿Qué te gustaría revisar?')
    expect(html).toContain('href="/credit-assessment?lang=es&amp;utm_source=advisor&amp;card=abc"')
    expect(html).toContain('href="/get-a-quote?lang=es&amp;utm_source=advisor&amp;card=abc"')
    expect(html).toContain('href="/family-assessment?lang=es&amp;utm_source=advisor&amp;card=abc"')
  })
  it('distinguishes a business insurance quote from personal owner assessments and service reviews', () => {
    const html = render('business', '/business-report-card')
    expect(html).toContain('href="/commercial-quote"')
    expect(html).toContain('not a business-credit assessment')
    expect(html).toContain('href="/business-assessment"')
    expect(html).toContain('Topics you do not complete are not scored')
  })
  it('keeps the existing specialized direct link focused on its original assessment', () => {
    const html = render('credit', '/credit-report-card?utm_source=advisor')
    expect(html).toContain('href="/credit-assessment?utm_source=advisor"')
    expect(html).not.toContain('id="review-topics"')
  })
})
