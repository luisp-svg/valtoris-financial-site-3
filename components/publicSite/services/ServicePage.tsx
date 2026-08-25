import type { ServiceCopy } from './copy'
import ServiceAudience from './ServiceAudience'
import ServiceCompliance from './ServiceCompliance'
import ServiceDiagnosticBridge from './ServiceDiagnosticBridge'
import ServiceFinalCta from './ServiceFinalCta'
import ServiceHero from './ServiceHero'
import ServiceProcess from './ServiceProcess'
import ServiceReviewAreas from './ServiceReviewAreas'
import { useServiceDocumentMeta } from './useServiceDocumentMeta'

type ServicePageProps = {
  copy: ServiceCopy
  diagnosticTo: string
}

export default function ServicePage({ copy, diagnosticTo }: ServicePageProps) {
  useServiceDocumentMeta(copy)

  return (
    <div className="platform-home site-home site-service-page">
      <ServiceHero copy={copy} diagnosticTo={diagnosticTo} />
      <ServiceAudience copy={copy} />
      <ServiceReviewAreas copy={copy} />
      <ServiceProcess copy={copy} />
      <ServiceDiagnosticBridge copy={copy} diagnosticTo={diagnosticTo} />
      <ServiceCompliance copy={copy} />
      <ServiceFinalCta copy={copy} diagnosticTo={diagnosticTo} />
    </div>
  )
}
