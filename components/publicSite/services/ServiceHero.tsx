import EditorialVisual from '../../premium/EditorialVisual'
import { useLocation } from 'react-router-dom'
import { EDITORIAL_IMAGES } from '../../premium/editorialImages'
import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'

type ServiceHeroProps = {
  copy: ServiceCopy
  primaryTo: string
  secondaryTo: string
}

export default function ServiceHero({ copy, primaryTo, secondaryTo }: ServiceHeroProps) {
  const { pathname } = useLocation()
  const hasVisual = Boolean(copy.heroImage || EDITORIAL_IMAGES[pathname])

  return (
    <section
      className={`site-home-hero site-service-hero${hasVisual ? ' site-service-hero--visual' : ''}`}
      aria-labelledby="service-hero-heading"
    >
      <div className={hasVisual ? 'container site-service-hero-grid' : 'container'}>
        <div className="site-home-hero-copy">
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
        {copy.heroImage ? (
          <div className="site-service-hero-visual">
            <img src={copy.heroImage} alt={copy.heroImageAlt ?? ''} loading="eager" />
          </div>
        ) : hasVisual ? <EditorialVisual compact /> : null}
      </div>
    </section>
  )
}
