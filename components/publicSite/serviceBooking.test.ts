import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ScheduleReportCardPage from '../../pages/ScheduleReportCardPage'
import { bookingUrlForAssessment, HEALTH_BOOKING_URL, readBookingService, schedulePathForAssessment, STUDENT_LOAN_BOOKING_URL } from '../../constants/booking'
import { STRATEGY_SESSION_BOOKING_URL } from '../../constants/urls'
import VersionedReportResults from '../reportCard/shortForm/ShortResults'
import { SHORT_CARDS, SHORT_FORM_FORMAT } from '../../modules/reportCard/shortForm/catalog'

describe('priority service booking handoff', () => {
  it('carries the Student Loan result context through the localized scheduling link', () => {
    const diagnostic = Object.fromEntries(SHORT_CARDS.student_loan.questions.map(q => [q.id, q.kind === 'multi' ? ['unknown'] : q.options && !q.options.some(o => o.value === 'unknown') ? q.options[q.options.length - 1].value : 'unknown']))
    const answers = { format: SHORT_FORM_FORMAT, assessmentType: 'student_loan', diagnostic }
    const html = renderToStaticMarkup(createElement(MemoryRouter, {
      initialEntries: [{ pathname: '/student-loan-results', search: '?lang=es&utm_source=facebook', state: { answers } }],
    }, createElement(VersionedReportResults, { assessmentType: 'student_loan', legacy: null })))
    expect(html).toContain('href="/schedule?lang=es&amp;utm_source=facebook&amp;service=student_loan"')
    expect(html).not.toContain('?service=student_loan?')
  })
  it.each([['health',HEALTH_BOOKING_URL,'Jazmin'],['student_loan',STUDENT_LOAN_BOOKING_URL,'Lizbeth'],['tsp',STRATEGY_SESSION_BOOKING_URL,'Luis']])('routes %s to its verified calendar', (type,url,owner) => {
    const entry = schedulePathForAssessment(type, '?lang=es&utm_source=facebook&utm_campaign=launch')
    const parsed = new URL(entry, 'https://www.valtorisfinancial.com')
    expect(parsed.pathname).toBe('/schedule')
    expect(parsed.searchParams.get('lang')).toBe('es')
    expect(parsed.searchParams.get('utm_source')).toBe('facebook')
    expect(parsed.searchParams.get('utm_campaign')).toBe('launch')
    expect(parsed.searchParams.get('service')).toBe(type)
    expect(bookingUrlForAssessment(readBookingService(parsed.search))).toBe(url)
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(ScheduleReportCardPage)))
    expect(html).toContain(`href="${url}"`)
    expect(html).toContain(owner)
    expect(html).toContain('Tu reunión será con')
  })
  it.each(['family','business','retirement','home_buyer','unknown'])('uses general scheduling for %s and clears stale service context', type => {
    const entry = schedulePathForAssessment(type,'?service=health&utm_source=facebook')
    expect(readBookingService(new URL(entry,'https://www.valtorisfinancial.com').search)).toBeUndefined()
    expect(bookingUrlForAssessment(type)).toBe(STRATEGY_SESSION_BOOKING_URL)
  })
  it.each(['https://untrusted.example','javascript:alert(1)','//untrusted.example','HEALTH',''])('rejects an unrecognized service %s as a destination', value => {
    const search = `?service=${encodeURIComponent(value)}&redirect=https://untrusted.example&email=private@example.invalid`
    expect(readBookingService(search)).toBeUndefined()
    expect(bookingUrlForAssessment(readBookingService(search))).toBe(STRATEGY_SESSION_BOOKING_URL)
  })
})
