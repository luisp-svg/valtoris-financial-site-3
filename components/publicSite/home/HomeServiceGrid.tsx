import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'
import { HOME_SERVICE_CARDS } from './homeConfig'
import SiteHomeSection from './SiteHomeSection'

type HomeServiceGridProps = {
  copy: HomeCopy
}

export default function HomeServiceGrid({ copy }: HomeServiceGridProps) {
  return (
    <SiteHomeSection
      tone="white"
      titleId="home-services-heading"
      title={copy.servicesHeading}
      lead={copy.servicesLead}
    >
      <div className="site-home-card-grid site-home-card-grid--4">
        {HOME_SERVICE_CARDS.map((item) => (
          <article key={item.id} className="site-home-card site-home-card--service">
            <h3 className="site-home-card-title">
              <PublicLink className="site-home-card-heading-link" to={item.to}>
                {copy[item.titleKey]}
              </PublicLink>
            </h3>
            {item.bodyKey ? <p className="site-home-card-copy">{copy[item.bodyKey]}</p> : null}
          </article>
        ))}
      </div>
    </SiteHomeSection>
  )
}
