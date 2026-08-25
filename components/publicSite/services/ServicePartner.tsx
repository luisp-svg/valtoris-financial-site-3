import type { ServiceCopy } from './copy'

type ServicePartnerProps = {
  copy: ServiceCopy
}

export default function ServicePartner({ copy }: ServicePartnerProps) {
  if (!copy.partnerName || !copy.partnerTitle || !copy.partnerBody) return null

  return (
    <section className="site-service-partner" aria-labelledby="service-partner-heading">
      <div className="container">
        <div className="site-service-partner-panel">
          {copy.partnerKicker ? <p className="platform-eyebrow">{copy.partnerKicker}</p> : null}
          <h2 id="service-partner-heading" className="site-service-partner-title">
            {copy.partnerTitle}
          </h2>
          <p className="site-service-partner-name">{copy.partnerName}</p>
          <p className="site-service-partner-copy">{copy.partnerBody}</p>
        </div>
      </div>
    </section>
  )
}
