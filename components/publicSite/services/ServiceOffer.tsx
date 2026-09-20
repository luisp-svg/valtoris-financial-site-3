import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'

type ServiceOfferProps = {
  copy: ServiceCopy
  to: string
}

export default function ServiceOffer({ copy, to }: ServiceOfferProps) {
  if (
    !copy.offerTitle ||
    !copy.offerLead ||
    !copy.offerPriceNote ||
    !copy.offerPlans?.length ||
    !copy.offerCta
  ) {
    return null
  }

  return (
    <section className="site-service-offer" aria-labelledby="service-offer-heading">
      <div className="container">
        <div className="site-service-offer-heading">
          {copy.offerKicker ? <p className="platform-eyebrow">{copy.offerKicker}</p> : null}
          <h2 id="service-offer-heading" className="site-service-offer-title">
            {copy.offerTitle}
          </h2>
          <p className="site-service-offer-lead">{copy.offerLead}</p>
        </div>
        <div className="site-service-offer-grid">
          {copy.offerPlans.map((plan) => (
            <article className={`site-service-offer-card${plan.badge ? ' site-service-offer-card--featured' : ''}`} key={plan.name}>
              {plan.badge ? <p className="site-service-offer-badge">{plan.badge}</p> : null}
              <h3>{plan.name}</h3>
              <p className="site-service-offer-price-value">{plan.price}</p>
              <p className="site-service-offer-cadence">{plan.cadence}</p>
              <p className="site-service-offer-description">{plan.description}</p>
              <ul className="site-service-offer-list">
                {plan.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="site-service-offer-footer">
          <p className="site-service-offer-price-note">{copy.offerPriceNote}</p>
          <PublicLink className="platform-btn platform-btn-primary" to={to}>
            {copy.offerCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
