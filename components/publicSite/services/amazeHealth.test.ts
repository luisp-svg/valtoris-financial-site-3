import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AmazeHealthServicePage from '../../../pages/AmazeHealthServicePage'
import AmazeHealthOffer from './AmazeHealthOffer'
import { AMAZE_ENROLLMENT_URL } from './amazeHealth'
import { SERVICES_NAV_LINKS } from '../navConfig'
function render(component: typeof AmazeHealthServicePage | typeof AmazeHealthOffer, entry: string) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(component)))
}
describe('Amaze membership enrollment journey', () => {
  it('offers the confirmed membership and sends enrollment only to the Valtoris partner code', () => {
    const html = render(AmazeHealthServicePage, '/amaze-health')
    const hrefs = [...html.matchAll(/href="([^"]*confirmaccess[^"]*)"/g)].map(match => match[1].replace(/&amp;/g, '&'))
    expect(hrefs).toHaveLength(4)
    expect(hrefs.every(href => href === AMAZE_ENROLLMENT_URL)).toBe(true)
    expect(html).toContain('$99')
    expect(html).toContain('Rx Valet')
    expect(html).toContain('does not replace health insurance')
    expect(html).toContain('Someone to call.')
    expect(html).toContain('/images/amaze-health/app-care.png')
    expect(html).toContain('Ashley, Hurricane, UT')
    expect(html).toContain('class="sticky"')
    expect((html.match(/<details/g) ?? []).length).toBe(8)
    expect(html).not.toContain('<form')
  })
  it('provides Spanish offer and terms while preserving exact external enrollment attribution', () => {
    const html = render(AmazeHealthServicePage, '/amaze-health?lang=es')
    expect(html).toContain('Inscribirme en Amaze Health')
    expect(html).toContain('no es un seguro')
    expect(html).toContain('referencecode=MUEN2MJL')
  })
  it('exposes one service destination and retains locale on internal offer links', () => {
    expect(SERVICES_NAV_LINKS.filter(link => link.to === '/amaze-health')).toHaveLength(1)
    expect(render(AmazeHealthOffer, '/health-disability?lang=es')).toContain('href="/amaze-health?lang=es"')
  })
})
