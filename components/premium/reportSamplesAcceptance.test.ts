import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ReportCardSamplesPage from '../../pages/ReportCardSamplesPage'
const render = (query:string) => renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[`/report-card-samples?${query}`]},createElement(ReportCardSamplesPage)))
describe('updated public report sample acceptance', () => {
 it('shows graded Health & Disability and Credit & Student Loans in Family', () => {
  const html = render('type=family')
  expect(html).toContain('Health &amp; Disability')
  expect(html).toContain('Credit &amp; Student Loans')
  expect(html).not.toContain('type=trucking')
  expect(html).not.toContain('Commercial Trucking')
 })
 it('shows distinct Retirement and Estate Planning & Exit Strategy results and anchors', () => {
  const html = render('type=business')
  expect(html).toContain('Estate Planning &amp; Exit Strategy')
  expect(html).toContain('id="review-estate_exit"')
  expect(html).toContain('href="#review-estate_exit"')
  expect(html).toContain('id="review-retirement"')
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1])
  expect(new Set(ids).size).toBe(ids.length)
 })
 it('does not render a trucking sample even through a direct sample query', () => {
  expect(render('type=trucking')).not.toContain('SAMPLE • Fictional information')
 })
 it('provides Spanish labels for new graded areas', () => {
  expect(render('type=family&lang=es')).toContain('Salud y discapacidad')
  expect(render('type=business&lang=es')).toContain('Planificación patrimonial y estrategia de salida')
 })
})
