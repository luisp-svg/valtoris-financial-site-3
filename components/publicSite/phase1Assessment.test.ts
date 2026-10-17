import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ReportCardsPage from '../../pages/ReportCardsPage'
import EducationPage from '../../pages/EducationPage'
import { ROUTES } from '../../constants/routes'

function render(page: typeof ReportCardsPage, path: string) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(page)))
}
describe('assessment-first discovery', () => {
  it('exposes all seven existing assessments and preserves campaign attribution', () => {
    const html = render(ReportCardsPage, '/report-cards?lang=es&utm_source=partner&card=advisor')
    for (const path of [ROUTES.reportCard, ROUTES.businessReportCard, ROUTES.retirementReportCard, ROUTES.studentLoanReportCard, ROUTES.creditReportCard, ROUTES.homeBuyerReportCard, ROUTES.protectionAnalysis]) {
      expect(html).toContain(`href="${path}?lang=es&amp;utm_source=partner&amp;card=advisor"`)
    }
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Elige tu Report Card')
  })
  it('organizes existing education into four categories with real destinations', () => {
    const html = render(EducationPage, '/education')
    for (const name of ['Protect', 'Strengthen', 'Build', 'Preserve']) expect(html).toContain(`>${name}</h3>`)
    for (const path of [ROUTES.insurance, ROUTES.credit, ROUTES.studentLoans, ROUTES.businessFormation, ROUTES.estateLegacy, ROUTES.taxStrategy]) expect(html).toContain(`href="${path}"`)
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})
