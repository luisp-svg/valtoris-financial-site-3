import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'
import { HOME_FEATURED_DIAGNOSTICS, HOME_MORE_DIAGNOSTICS } from './homeConfig'
import SiteHomeSection from './SiteHomeSection'

type HomeDiagnosticsProps = {
  copy: HomeCopy
}

export default function HomeDiagnostics({ copy }: HomeDiagnosticsProps) {
  return (
    <SiteHomeSection
      id="home-diagnostics"
      tone="gray"
      titleId="home-diagnostics-heading"
      title={copy.diagnosticsHeading}
      kicker={copy.diagnosticsBrand}
      lead={copy.diagnosticsLead}
    >
      <div className="site-home-card-grid site-home-card-grid--4">
        {HOME_FEATURED_DIAGNOSTICS.map((item) => (
          <article key={item.id} className="site-home-card">
            <h3 className="site-home-card-title">{copy[item.titleKey]}</h3>
            {item.bodyKey ? <p className="site-home-card-copy">{copy[item.bodyKey]}</p> : null}
            <PublicLink className="site-home-card-link" to={item.to}>
              {copy[item.titleKey]}
            </PublicLink>
          </article>
        ))}
      </div>
      <div className="site-home-more-tools">
        <h3 className="site-home-more-heading">{copy.diagnosticsMoreHeading}</h3>
        <ul className="site-home-more-list">
          {HOME_MORE_DIAGNOSTICS.map((item) => (
            <li key={item.id}>
              <PublicLink className="site-home-text-link" to={item.to}>
                {copy[item.titleKey]}
              </PublicLink>
            </li>
          ))}
        </ul>
      </div>
    </SiteHomeSection>
  )
}
