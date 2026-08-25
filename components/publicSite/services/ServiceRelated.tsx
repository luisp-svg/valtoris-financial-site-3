import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'

type ServiceRelatedProps = {
  copy: ServiceCopy
  to?: string
}

export default function ServiceRelated({ copy, to }: ServiceRelatedProps) {
  if (!to || !copy.relatedTitle || !copy.relatedBody || !copy.relatedCta) return null

  return (
    <section className="site-service-related" aria-labelledby="service-related-heading">
      <div className="container">
        <div className="site-service-partner-panel">
          {copy.relatedKicker ? <p className="platform-eyebrow">{copy.relatedKicker}</p> : null}
          <h2 id="service-related-heading" className="site-service-partner-title">
            {copy.relatedTitle}
          </h2>
          <p className="site-service-partner-copy">{copy.relatedBody}</p>
          <PublicLink className="site-home-text-link" to={to}>
            {copy.relatedCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
