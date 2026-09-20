import SampleResultsPreview from '../../home/SampleResultsPreview'
import { ROUTES } from '../../../constants/routes'
import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'

type HomeReportCardShowcaseProps = {
  copy: HomeCopy
}

export default function HomeReportCardShowcase({ copy }: HomeReportCardShowcaseProps) {
  return (
    <section className="site-home-showcase" aria-labelledby="home-showcase-heading">
      <div className="container site-home-showcase-grid">
        <div className="site-home-showcase-copy">
          <p className="site-home-kicker">{copy.showcaseKicker}</p>
          <h2 id="home-showcase-heading" className="platform-section-title">
            {copy.showcaseHeading}
          </h2>
          <p className="site-home-showcase-lead">{copy.showcaseLead}</p>
          <ul className="site-home-showcase-list">
            <li>{copy.showcaseBenefitOne}</li>
            <li>{copy.showcaseBenefitTwo}</li>
            <li>{copy.showcaseBenefitThree}</li>
          </ul>
          <div className="site-home-hero-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.reportCard}>
              {copy.showcaseCta}
            </PublicLink>
            <PublicLink className="site-home-text-link" to={ROUTES.solutions}>
              {copy.showcaseSecondaryCta}
            </PublicLink>
          </div>
        </div>
        <SampleResultsPreview
          compact
          ariaLabel={copy.showcasePreviewLabel}
          badge={copy.showcasePreviewBadge}
          disclaimer={copy.showcasePreviewDisclaimer}
        />
      </div>
    </section>
  )
}
