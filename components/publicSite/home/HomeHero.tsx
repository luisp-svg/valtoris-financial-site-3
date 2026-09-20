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
          <p className="site-home-hero-brand">{copy.heroBrand}</p>
          <div className="site-home-hero-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={HOME_DIAGNOSTICS_HASH}>
              {copy.heroPrimaryCta}
            </PublicLink>
            <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
              {copy.heroSecondaryCta}
            </PublicLink>
          </div>
          <p className="site-home-hero-microcopy">{copy.heroMicrocopy}</p>
          <PublicLink className="site-home-text-link" to={ROUTES.solutions}>
            {copy.heroTertiaryCta}
          </PublicLink>
        </div>
        <figure className="site-home-hero-visual">
          <img
            src="/images/valtoris-home-hero.webp"
            alt={copy.heroImageAlt}
            width="1600"
            height="800"
            fetchPriority="high"
          />
          <figcaption className="site-home-hero-caption">
            <strong>{copy.heroPanelLabel}</strong>
            <span>{copy.heroPanelProtection} · {copy.heroPanelRetirement} · {copy.heroPanelCredit}</span>
          </figcaption>
        </figure>
      </div>
      <div className="container site-home-trust-strip" aria-label={copy.trustLabel}>
        <span>{copy.trustEducation}</span>
        <span>{copy.trustBilingual}</span>
        <span>{copy.trustCoordinated}</span>
        <span>{copy.trustNoObligation}</span>
      </div>
    </section>
  )
}
