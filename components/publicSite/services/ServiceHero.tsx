import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'

type ServiceHeroProps = {
  copy: ServiceCopy
  primaryTo: string
  secondaryTo: string
}

export default function ServiceHero({ copy, primaryTo, secondaryTo }: ServiceHeroProps) {
  return (
    <section className="site-home-hero site-service-hero" aria-labelledby="service-hero-heading">
      <div className="container site-home-hero-copy">
        <p className="platform-eyebrow">{copy.heroEyebrow}</p>
        <h1 id="service-hero-heading" className="site-home-headline">
          {copy.heroTitle}
        </h1>
        <p className="site-home-hero-support">{copy.heroSupport}</p>
        <div className="site-home-hero-actions">
          <PublicLink className="platform-btn platform-btn-primary" to={primaryTo}>
            {copy.heroPrimaryCta}
          </PublicLink>
          <PublicLink className="platform-btn platform-btn-secondary" to={secondaryTo}>
            {copy.heroSecondaryCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
