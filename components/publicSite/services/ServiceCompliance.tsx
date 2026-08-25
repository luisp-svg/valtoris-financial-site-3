import type { ServiceCopy } from './copy'

type ServiceComplianceProps = {
  copy: ServiceCopy
}

export default function ServiceCompliance({ copy }: ServiceComplianceProps) {
  return (
    <section className="site-service-compliance" aria-labelledby="service-compliance-heading">
      <div className="container site-service-compliance-inner">
        <h2 id="service-compliance-heading" className="site-service-compliance-title">
          {copy.complianceHeading}
        </h2>
        <p className="site-service-compliance-copy">{copy.complianceBody}</p>
        {copy.complianceResourceHref ? (
          <a
            className="site-home-text-link"
            href={copy.complianceResourceHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.complianceResourceLabel}
          </a>
        ) : null}
      </div>
    </section>
  )
}
