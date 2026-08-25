import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'

type ServiceFinalCtaProps = {
  copy: ServiceCopy
  primaryTo: string
  secondaryTo: string
}

export default function ServiceFinalCta({ copy, primaryTo, secondaryTo }: ServiceFinalCtaProps) {
  return (
    <section className="site-home-final" aria-labelledby="service-final-heading">
      <div className="container site-home-final-inner">
        <h2 id="service-final-heading" className="site-home-final-title">
          {copy.finalHeading}
        </h2>
        <p className="site-home-final-copy">{copy.finalLead}</p>
        <div className="site-home-final-actions">
          <PublicLink className="platform-btn platform-btn-primary" to={primaryTo}>
            {copy.finalPrimaryCta}
          </PublicLink>
          <PublicLink className="platform-btn platform-btn-secondary" to={secondaryTo}>
            {copy.finalSecondaryCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
