import type { HomeCopy } from './copy'
import SiteHomeSection from './SiteHomeSection'

type HomeWhyValtorisProps = {
  copy: HomeCopy
}

export default function HomeWhyValtoris({ copy }: HomeWhyValtorisProps) {
  const items = [
    { title: copy.whyCoordinatedTitle, body: copy.whyCoordinatedBody },
    { title: copy.whyUnderstandTitle, body: copy.whyUnderstandBody },
    { title: copy.whyPrioritiesTitle, body: copy.whyPrioritiesBody },
    { title: copy.whyReviewTitle, body: copy.whyReviewBody },
  ]

  return (
    <SiteHomeSection
      tone="blue"
      titleId="home-why-heading"
      title={copy.whyHeading}
      lead={copy.whyLead}
    >
      <p className="site-home-why-support">{copy.whySupport}</p>
      <div className="site-home-card-grid site-home-card-grid--2">
        {items.map((item) => (
          <article key={item.title} className="site-home-card">
            <h3 className="site-home-card-title">{item.title}</h3>
            <p className="site-home-card-copy">{item.body}</p>
          </article>
        ))}
      </div>
    </SiteHomeSection>
  )
}
