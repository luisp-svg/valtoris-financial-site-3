import { useLocation } from 'react-router-dom'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { ServiceCopy } from './copy'

type ServiceHeroProps = {
  copy: ServiceCopy
  diagnosticTo: string
}

export default function ServiceHero({ copy, diagnosticTo }: ServiceHeroProps) {
  const location = useLocation()

  return (
    <section className="site-home-hero site-service-hero" aria-labelledby="service-hero-heading">
      <div className="container site-home-hero-copy">
        <p className="platform-eyebrow">{copy.heroEyebrow}</p>
        <h1 id="service-hero-heading" className="site-home-headline">
          {copy.heroTitle}
        </h1>
        <p className="site-home-hero-support">{copy.heroSupport}</p>
        <div className="site-home-hero-actions">
          <PublicLink className="platform-btn platform-btn-primary" to={diagnosticTo}>
            {copy.heroPrimaryCta}
          </PublicLink>
          <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
            {copy.heroSecondaryCta}
          </PublicLink>
        </div>
        <PublicLink className="site-home-text-link" to={`${location.pathname}#service-process`}>
          {copy.heroTertiaryCta}
        </PublicLink>
      </div>
    </section>
  )
}
