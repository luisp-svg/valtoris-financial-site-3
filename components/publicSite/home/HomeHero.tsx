import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { HomeCopy } from './copy'
import { HOME_DIAGNOSTICS_HASH } from './homeConfig'

type HomeHeroProps = {
  copy: HomeCopy
}

export default function HomeHero({ copy }: HomeHeroProps) {
  return (
    <section className="site-home-hero" aria-labelledby="home-hero-heading">
      <div className="container site-home-hero-grid">
        <div className="site-home-hero-copy">
          <p className="platform-eyebrow">{copy.heroEyebrow}</p>
          <h1 id="home-hero-heading" className="site-home-headline">
            {copy.heroTitle}
          </h1>
          <p className="site-home-hero-support">{copy.heroSupport}</p>
          <div className="site-home-hero-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.solutions}>
              {copy.heroPrimaryCta}
            </PublicLink>
            <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
              {copy.heroSecondaryCta}
            </PublicLink>
          </div>
          <PublicLink className="site-home-text-link" to={HOME_DIAGNOSTICS_HASH}>
            {copy.heroTertiaryCta}
          </PublicLink>
        </div>
        <aside className="site-home-hero-panel" aria-label={copy.heroPanelLabel}>
          <p className="site-home-hero-panel-label">{copy.heroPanelLabel}</p>
          <ul className="site-home-hero-panel-list">
            <li>{copy.heroPanelProtection}</li>
            <li>{copy.heroPanelRetirement}</li>
            <li>{copy.heroPanelCredit}</li>
            <li>{copy.heroPanelStudentLoans}</li>
          </ul>
        </aside>
      </div>
    </section>
  )
}
