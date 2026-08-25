import PublicLink from '../PublicLink'
import type { ServiceCopy } from './copy'
import SiteHomeSection from '../home/SiteHomeSection'

type ServiceDiagnosticBridgeProps = {
  copy: ServiceCopy
  primaryTo: string
}

export default function ServiceDiagnosticBridge({ copy, primaryTo }: ServiceDiagnosticBridgeProps) {
  return (
    <SiteHomeSection
      tone="blue"
      titleId="service-bridge-heading"
      kicker={copy.bridgeKicker}
      title={copy.bridgeTitle}
      lead={copy.bridgeBody}
    >
      <div className="site-home-hero-actions">
        <PublicLink className="platform-btn platform-btn-primary" to={primaryTo}>
          {copy.bridgePrimaryCta}
        </PublicLink>
      </div>
    </SiteHomeSection>
  )
}
