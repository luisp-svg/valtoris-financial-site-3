import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SiteHeader from '../../SiteHeader'
import SolutionsPage from '../../../pages/SolutionsPage'
import { publicReportCards } from '../../../modules/reportCard/funnelStrategy'
import { TOOLS_NAV_LINKS } from '../navConfig'

function render(page: typeof SolutionsPage | typeof SiteHeader, path = '/solutions') {
  return renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[path]},createElement(page)))
}
describe('one solutions and Report Card journey',()=>{
  it('gives the two main and five supporting cards one distinct direct assessment action',()=>{
    const html=render(SolutionsPage)
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    expect(html.match(/<article>/g)).toHaveLength(7)
    expect(new Set(publicReportCards.map(p=>p.id)).size).toBe(7)
    expect(new Set(publicReportCards.map(p=>p.path)).size).toBe(7)
    for(const p of publicReportCards) expect(html).toContain(`href="/financial-assessment?focus=${p.id}"`)
    expect(html).toContain('Main Report Cards')
    expect(html).toContain('Supporting Report Cards')
    expect(html).not.toContain('/commercial-trucking-report-card')
    expect(html).not.toContain('focus=trucking')
    expect(html).toContain('not product applications')
  })
  it('retains access to service information without making it a mandatory extra step',()=>{
    const html=render(SolutionsPage)
    for(const p of publicReportCards) expect(html).toContain(`href="${p.path}"`)
    expect(html).toContain('Business Owner Financial Report Card')
    expect(html).toContain('What the Review Covers')
    expect(html).not.toContain('href="/report-cards"')
  })
  it('preserves Spanish and attribution alongside destination-specific priorities',()=>{
    const html=render(SolutionsPage,'/solutions?lang=es&utm_source=qa&card=test')
    expect(html).toContain('Empieza con lo que más importa.')
    for(const p of publicReportCards) {
      const encoded=`href="/financial-assessment?lang=es&amp;utm_source=qa&amp;card=test&amp;focus=${p.id}"`
      expect(html).toContain(encoded)
    }
  })
  it('uses one combined menu and one Home destination, with main cards first',()=>{
    const html=render(SiteHeader,'/')
    expect(TOOLS_NAV_LINKS).toHaveLength(7)
    for(const item of TOOLS_NAV_LINKS)expect(html).toContain(`href="${item.to}"`)
    expect(html).toContain('Solutions &amp; Report Cards')
    expect(html).not.toContain('Who We Serve')
    expect(html).not.toContain('About Valtoris')
    expect(html).not.toContain('Insights')
    expect(html).not.toContain('site-mobile-drawer-title')
    expect(html).not.toContain('site-mobile-services')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })
})
