import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'
import { HOME_AUDIENCE_PATHS } from './homeConfig'
import SiteHomeSection from './SiteHomeSection'

type HomeAudiencePathsProps = {
  copy: HomeCopy
}

export default function HomeAudiencePaths({ copy }: HomeAudiencePathsProps) {
  return (
    <SiteHomeSection
      tone="blue"
      titleId="home-audience-heading"
      title={copy.audienceHeading}
      lead={copy.audienceLead}
    >
      <div className="site-home-card-grid site-home-card-grid--4">
        {HOME_AUDIENCE_PATHS.map((item) => (
          <article key={item.id} className="site-home-card">
            <h3 className="site-home-card-title">{copy[item.titleKey]}</h3>
            {item.bodyKey ? <p className="site-home-card-copy">{copy[item.bodyKey]}</p> : null}
            {item.ctaKey ? (
              <PublicLink className="site-home-card-link" to={item.to}>
                {copy[item.ctaKey]}
              </PublicLink>
            ) : null}
          </article>
        ))}
      </div>
    </SiteHomeSection>
  )
}
