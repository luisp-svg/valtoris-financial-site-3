import type { ServiceCopy } from './copy'
import type { ServiceLinks } from './serviceLinks'
import ServiceAudience from './ServiceAudience'
import ServiceCompliance from './ServiceCompliance'
import ServiceDiagnosticBridge from './ServiceDiagnosticBridge'
import ServiceFinalCta from './ServiceFinalCta'
import ServiceHero from './ServiceHero'
import ServicePartner from './ServicePartner'
import ServiceProcess from './ServiceProcess'
import ServiceRelated from './ServiceRelated'
import ServiceReviewAreas from './ServiceReviewAreas'
import { useServiceDocumentMeta } from './useServiceDocumentMeta'

type ServicePageProps = {
  copy: ServiceCopy
  links: ServiceLinks
}

export default function ServicePage({ copy, links }: ServicePageProps) {
  useServiceDocumentMeta(copy)

  return (
    <div className="platform-home site-home site-service-page">
      <ServiceHero copy={copy} primaryTo={links.primaryTo} secondaryTo={links.secondaryTo} />
      <ServiceAudience copy={copy} />
      <ServiceReviewAreas copy={copy} />
      <ServicePartner copy={copy} />
      <ServiceRelated copy={copy} to={links.relatedTo} />
      <ServiceProcess copy={copy} />
      <ServiceDiagnosticBridge copy={copy} primaryTo={links.bridgePrimaryTo} />
      <ServiceCompliance copy={copy} />
      <ServiceFinalCta copy={copy} primaryTo={links.finalPrimaryTo} secondaryTo={links.finalSecondaryTo} />
    </div>
  )
}
