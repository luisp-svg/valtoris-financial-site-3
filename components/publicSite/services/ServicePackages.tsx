import PublicLink from '../PublicLink'
import SiteHomeSection from '../home/SiteHomeSection'
import type { ServiceCopy } from './copy'

type ServicePackagesProps = {
  copy: ServiceCopy
  startTo: string
}

export default function ServicePackages({ copy, startTo }: ServicePackagesProps) {
  if (!copy.packages?.length || !copy.packagesHeading || !copy.packagesLead) return null

  return (
    <SiteHomeSection
      tone="gray"
      titleId="service-packages-heading"
      title={copy.packagesHeading}
      lead={copy.packagesLead}
    >
      <div className="site-service-package-grid">
        {copy.packages.map((servicePackage) => (
          <article
            key={servicePackage.name}
            className={`site-service-package${servicePackage.featured ? ' site-service-package--featured' : ''}`}
          >
            {servicePackage.badge ? (
              <p className="site-service-package-badge">{servicePackage.badge}</p>
            ) : null}
            <h3 className="site-service-package-name">{servicePackage.name}</h3>
            <p className="site-service-package-price">{servicePackage.price}</p>
            <p className="site-service-package-payment">{servicePackage.paymentNote}</p>
            <p className="site-service-package-description">{servicePackage.description}</p>
            <ul className="site-service-package-features">
              {servicePackage.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <PublicLink className="platform-btn platform-btn-primary" to={startTo}>
              {servicePackage.cta}
            </PublicLink>
          </article>
        ))}
      </div>
      {copy.packagesNote ? <p className="site-service-package-note">{copy.packagesNote}</p> : null}
    </SiteHomeSection>
  )
}
