import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { HomeCopy } from './copy'
import SiteHomeSection from './SiteHomeSection'

type HomeAudienceJourneysProps = {
  copy: HomeCopy
}

export default function HomeAudienceJourneys({ copy }: HomeAudienceJourneysProps) {
  return (
    <SiteHomeSection
      tone="white"
      titleId="home-journeys-heading"
      title={copy.journeysHeading}
      lead={copy.journeysLead}
    >
      <div className="site-home-card-grid site-home-card-grid--2 site-home-card-grid--journeys">
        <article className="site-home-card site-home-card--journey">
          <h3 className="site-home-card-title">{copy.journeyFamilyTitle}</h3>
          <p className="site-home-card-copy">{copy.journeyFamilyBody}</p>
          <p className="site-home-topic-line">{copy.journeyFamilyTopics}</p>
          <div className="site-home-card-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.solutions}>
              {copy.journeyFamilyCta}
            </PublicLink>
          </div>
        </article>
        <article className="site-home-card site-home-card--journey">
          <h3 className="site-home-card-title">{copy.journeyBusinessTitle}</h3>
          <p className="site-home-card-copy">{copy.journeyBusinessBody}</p>
          <p className="site-home-topic-line">{copy.journeyBusinessTopics}</p>
          <div className="site-home-card-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.solutions}>
              {copy.journeyBusinessCta}
            </PublicLink>
          </div>
        </article>
      </div>
    </SiteHomeSection>
  )
}
