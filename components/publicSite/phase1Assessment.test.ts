import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SolutionsPage from '../../pages/SolutionsPage'
import { specializedFunnels } from '../../modules/reportCard/funnelStrategy'
import ReportCardsPage from '../../pages/ReportCardsPage'
import EducationPage from '../../pages/EducationPage'
import { ROUTES } from '../../constants/routes'

function render(page: typeof ReportCardsPage, path: string) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(page)))
}
describe('assessment-first discovery', () => {
  it('exposes all nine specialized funnels in the directory with attribution', () => {
    const html = render(SolutionsPage, '/solutions?lang=es&utm_source=partner&card=advisor')
    for (const item of specializedFunnels) expect(html).toContain(`href="/financial-assessment?lang=es&amp;utm_source=partner&amp;card=advisor&amp;focus=${item.id}"`)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Empieza con lo que más importa.')
  })
  it('offers six distinct preparation guides with real destinations', () => {
    const html = render(EducationPage, '/education')
    expect(html.match(/<article>/g)).toHaveLength(6)
    expect(html.match(/<details>/g)).toHaveLength(6)
    expect(html).toContain('Questions to Consider')
    expect(html).toContain('General educational content')
    for (const path of [ROUTES.protectionAnalysis, ROUTES.credit, ROUTES.retirementReportCard, ROUTES.homeBuyerReportCard, ROUTES.businessReportCard, ROUTES.estateLegacy]) expect(html).toContain(`href="${path}"`)
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})
