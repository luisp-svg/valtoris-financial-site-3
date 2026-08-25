import type { ServiceCopy } from './copy'
import SiteHomeSection from '../home/SiteHomeSection'

type ServiceReviewAreasProps = {
  copy: ServiceCopy
}

export default function ServiceReviewAreas({ copy }: ServiceReviewAreasProps) {
  return (
    <SiteHomeSection
      tone="white"
      titleId="service-review-heading"
      title={copy.reviewHeading}
      lead={copy.reviewLead}
    >
      <div className="site-home-card-grid site-home-card-grid--3">
        {copy.reviewAreas.map((area) => (
          <article key={area.title} className="site-home-card">
            <h3 className="site-home-card-title">{area.title}</h3>
            <p className="site-home-card-copy">{area.body}</p>
          </article>
        ))}
      </div>
    </SiteHomeSection>
  )
}
