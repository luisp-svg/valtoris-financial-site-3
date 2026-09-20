import { ROUTES } from '../../../constants/routes'
import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'

type HomeFounderStoryProps = {
  copy: HomeCopy
}

export default function HomeFounderStory({ copy }: HomeFounderStoryProps) {
  return (
    <section className="site-home-founder" aria-labelledby="home-founder-heading">
      <div className="container site-home-founder-grid">
        <div className="site-home-founder-image-wrap">
          <img
            className="site-home-founder-image"
            src="/images/luis-family-story.webp"
            alt={copy.founderImageAlt}
            width="720"
            height="1080"
            loading="lazy"
          />
        </div>
        <div className="site-home-founder-copy">
          <p className="site-home-kicker">{copy.founderKicker}</p>
          <h2 id="home-founder-heading" className="platform-section-title">
            {copy.founderHeading}
          </h2>
          <p>{copy.founderBody}</p>
          <p className="site-home-founder-signature">{copy.founderName}</p>
          <p className="site-home-founder-role">{copy.founderRole}</p>
          <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
            {copy.founderCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
