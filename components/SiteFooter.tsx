import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { chromeCopy } from './publicSite/chromeCopy'
import { readPublicLocale } from './publicSite/locale'
import PublicLink from './publicSite/PublicLink'
import PublicLocaleSwitcher from './publicSite/PublicLocaleSwitcher'
import {
  BUSINESS_FOOTER_LINKS,
  COMPANY_FOOTER_LINKS,
  FAMILIES_FOOTER_LINKS,
  TOOLS_NAV_LINKS,
} from './publicSite/navConfig'

export default function SiteFooter() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = chromeCopy[locale]

  return (
    <footer className="footer site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-sitemap">
          <section className="site-footer-col" aria-labelledby="footer-company-heading">
            <h2 id="footer-company-heading" className="site-footer-heading">
              {copy.footerCompany}
            </h2>
            <p className="site-footer-brand">Valtoris Financial</p>
            <p className="site-footer-brand-line">{copy.footerBrandLine}</p>
            <nav className="site-footer-links" aria-label={copy.footerCompany}>
              {COMPANY_FOOTER_LINKS.map((item) =>
                item.to === ROUTES.crmLogin ? (
                  <Link key={item.id} className="site-footer-advisor" to={item.to}>
                    {copy[item.labelKey]}
                  </Link>
                ) : (
                  <PublicLink key={item.id} to={item.to}>
                    {copy[item.labelKey]}
                  </PublicLink>
                ),
              )}
            </nav>
          </section>

          <section className="site-footer-col" aria-labelledby="footer-families-heading">
            <h2 id="footer-families-heading" className="site-footer-heading">
              {copy.footerFamilies}
            </h2>
            <nav className="site-footer-links" aria-label={copy.footerFamilies}>
              {FAMILIES_FOOTER_LINKS.map((item) => (
                <PublicLink key={item.id} to={item.to}>
                  {copy[item.labelKey]}
                </PublicLink>
              ))}
            </nav>
          </section>

          <section className="site-footer-col" aria-labelledby="footer-business-heading">
            <h2 id="footer-business-heading" className="site-footer-heading">
              {copy.footerBusiness}
            </h2>
            <nav className="site-footer-links" aria-label={copy.footerBusiness}>
              {BUSINESS_FOOTER_LINKS.map((item) => (
                <PublicLink key={item.id} to={item.to}>
                  {copy[item.labelKey]}
                </PublicLink>
              ))}
            </nav>
          </section>

          <section className="site-footer-col" aria-labelledby="footer-tools-heading">
            <h2 id="footer-tools-heading" className="site-footer-heading">
              {copy.footerTools}
            </h2>
            <nav className="site-footer-links" aria-label={copy.footerTools}>
              {TOOLS_NAV_LINKS.map((item) => (
                <PublicLink key={item.id} to={item.to}>
                  {copy[item.labelKey]}
                </PublicLink>
              ))}
            </nav>
          </section>
        </div>

        <div className="site-footer-legal">
          <nav className="site-footer-legal-nav" aria-label={copy.footerLegalNav}>
            <PublicLink to={ROUTES.privacy}>{copy.footerPrivacy}</PublicLink>
          </nav>
          <p className="notice site-footer-disclaimer">{copy.footerDisclaimer}</p>
          <PublicLocaleSwitcher
            className="site-locale-switcher site-footer-locale"
            locale={locale}
            groupLabel={copy.languageGroup}
            englishLabel={copy.languageEnglish}
            spanishLabel={copy.languageSpanish}
          />
        </div>
      </div>
    </footer>
  )
}
