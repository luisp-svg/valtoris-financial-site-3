import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { ServiceCopy } from './copy'
import SiteHomeSection from '../home/SiteHomeSection'

type ServiceDiagnosticBridgeProps = {
  copy: ServiceCopy
  diagnosticTo: string
}

export default function ServiceDiagnosticBridge({ copy, diagnosticTo }: ServiceDiagnosticBridgeProps) {
  return (
    <SiteHomeSection
      tone="blue"
      titleId="service-bridge-heading"
      kicker={copy.bridgeKicker}
      title={copy.bridgeTitle}
      lead={copy.bridgeBody}
    >
      <div className="site-home-hero-actions">
        <PublicLink className="platform-btn platform-btn-primary" to={diagnosticTo}>
          {copy.bridgePrimaryCta}
        </PublicLink>
        <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
          {copy.bridgeSecondaryCta}
        </PublicLink>
      </div>
    </SiteHomeSection>
  )
}
