import type { ServiceCopy } from './copy'
import SiteHomeSection from '../home/SiteHomeSection'

type ServiceAudienceProps = {
  copy: ServiceCopy
}

export default function ServiceAudience({ copy }: ServiceAudienceProps) {
  return (
    <SiteHomeSection
      tone="blue"
      titleId="service-audience-heading"
      title={copy.audienceHeading}
      lead={copy.audienceLead}
    >
      <ul className="site-service-audience-list">
        {copy.audienceItems.map((item) => (
          <li key={item} className="site-home-card site-service-audience-item">
            {item}
          </li>
        ))}
      </ul>
    </SiteHomeSection>
  )
}
