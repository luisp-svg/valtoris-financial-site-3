import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { ServiceCopy } from './copy'

type ServiceFinalCtaProps = {
  copy: ServiceCopy
  diagnosticTo: string
}

export default function ServiceFinalCta({ copy, diagnosticTo }: ServiceFinalCtaProps) {
  return (
    <section className="site-home-final" aria-labelledby="service-final-heading">
      <div className="container site-home-final-inner">
        <h2 id="service-final-heading" className="site-home-final-title">
          {copy.finalHeading}
        </h2>
        <p className="site-home-final-copy">{copy.finalLead}</p>
        <div className="site-home-final-actions">
          <PublicLink className="platform-btn platform-btn-secondary" to={diagnosticTo}>
            {copy.finalPrimaryCta}
          </PublicLink>
          <PublicLink className="site-home-final-text" to={ROUTES.schedule}>
            {copy.finalSecondaryCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
