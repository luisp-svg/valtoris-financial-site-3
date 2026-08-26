import PublicLink from '../PublicLink'
import SiteHomeSection from '../home/SiteHomeSection'
import { ROUTES } from '../../../constants/routes'
import type { SolutionsCopy } from './copy'
import {
  SOLUTIONS_BUSINESS_CARDS,
  SOLUTIONS_DIAGNOSTICS_HASH,
  SOLUTIONS_DIAGNOSTICS_ID,
  SOLUTIONS_FAMILY_CARDS,
  SOLUTIONS_TOOL_CARDS,
  type SolutionsCardItem,
} from './solutionsConfig'

type SolutionsHubProps = {
  copy: SolutionsCopy
}

function SolutionsCardGrid({
  cards,
  copy,
  columns,
}: {
  cards: readonly SolutionsCardItem[]
  copy: SolutionsCopy
  columns: 3 | 4
}) {
  return (
    <div className={`site-home-card-grid site-home-card-grid--${columns}`}>
      {cards.map((item) => (
        <article key={`${item.id}-${item.to}`} className="site-home-card site-home-card--centered">
          <h3 className="site-home-card-title">{copy[item.titleKey]}</h3>
          <p className="site-home-card-copy">{copy[item.bodyKey]}</p>
          <div className="site-home-card-actions">
            <PublicLink className="platform-btn platform-btn-outline" to={item.to}>
              {copy[item.ctaKey]}
            </PublicLink>
          </div>
        </article>
      ))}
    </div>
  )
}

export default function SolutionsHub({ copy }: SolutionsHubProps) {
  return (
    <div className="platform-home site-home site-solutions-hub">
      <section className="site-home-hero site-service-hero" aria-labelledby="solutions-hero-heading">
        <div className="container site-home-hero-copy">
          <p className="platform-eyebrow">{copy.heroEyebrow}</p>
          <h1 id="solutions-hero-heading" className="site-home-headline">
            {copy.heroTitle}
          </h1>
          <p className="site-home-hero-support">{copy.heroSupport}</p>
          <p className="site-home-hero-brand">{copy.heroBrand}</p>
          <div className="site-home-hero-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={SOLUTIONS_DIAGNOSTICS_HASH}>
              {copy.heroPrimaryCta}
            </PublicLink>
            <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
              {copy.heroSecondaryCta}
            </PublicLink>
          </div>
        </div>
      </section>

      <SiteHomeSection
        id={SOLUTIONS_DIAGNOSTICS_ID}
        tone="blue"
        titleId="solutions-tools-heading"
        title={copy.toolsHeading}
        kicker={copy.toolsBrand}
        lead={copy.toolsLead}
      >
        <SolutionsCardGrid cards={SOLUTIONS_TOOL_CARDS} copy={copy} columns={3} />
      </SiteHomeSection>

      <SiteHomeSection
        tone="white"
        titleId="solutions-families-heading"
        title={copy.familyHeading}
        lead={copy.familyLead}
      >
        <SolutionsCardGrid cards={SOLUTIONS_FAMILY_CARDS} copy={copy} columns={4} />
      </SiteHomeSection>

      <SiteHomeSection
        tone="gray"
        titleId="solutions-business-heading"
        title={copy.businessHeading}
        lead={copy.businessLead}
      >
        <SolutionsCardGrid cards={SOLUTIONS_BUSINESS_CARDS} copy={copy} columns={3} />
      </SiteHomeSection>

      <SiteHomeSection
        tone="white"
        titleId="solutions-coordination-heading"
        title={copy.coordinationHeading}
        lead={copy.coordinationLead}
      >
        <ul className="site-solutions-coordination-list">
          <li>{copy.coordination1}</li>
          <li>{copy.coordination2}</li>
          <li>{copy.coordination3}</li>
          <li>{copy.coordination4}</li>
          <li>{copy.coordination5}</li>
        </ul>
        <p className="site-solutions-coordination-close">{copy.coordinationClose}</p>
      </SiteHomeSection>

      <section className="site-solutions-disclaimer">
        <div className="container">
          <p className="notice">{copy.disclaimer}</p>
        </div>
      </section>

      <section className="site-home-final" aria-labelledby="solutions-final-heading">
        <div className="container site-home-final-inner">
          <h2 id="solutions-final-heading" className="site-home-final-title">
            {copy.finalHeading}
          </h2>
          <p className="site-home-final-copy">{copy.finalLead}</p>
          <div className="site-home-final-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={SOLUTIONS_DIAGNOSTICS_HASH}>
              {copy.finalPrimaryCta}
            </PublicLink>
            <PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>
              {copy.finalSecondaryCta}
            </PublicLink>
          </div>
        </div>
      </section>
    </div>
  )
}
