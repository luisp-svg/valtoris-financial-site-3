import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { HomeCopy } from './copy'

type HomeFinalCtaProps = {
  copy: HomeCopy
}

export default function HomeFinalCta({ copy }: HomeFinalCtaProps) {
  return (
    <section className="site-home-final" aria-labelledby="home-final-heading">
      <div className="container site-home-final-inner">
        <h2 id="home-final-heading" className="site-home-final-title">
          {copy.finalHeading}
        </h2>
        <p className="site-home-final-copy">{copy.finalLead}</p>
        <div className="site-home-final-actions">
          <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.schedule}>
            {copy.finalPrimaryCta}
          </PublicLink>
        </div>
      </div>
    </section>
  )
}
