import type { ReactNode } from 'react'

type SiteHomeSectionProps = {
  id?: string
  tone: 'white' | 'blue' | 'gray' | 'navy'
  titleId: string
  title: string
  lead?: string
  kicker?: string
  children: ReactNode
}

export default function SiteHomeSection({
  id,
  tone,
  titleId,
  title,
  lead,
  kicker,
  children,
}: SiteHomeSectionProps) {
  return (
    <section
      id={id}
      className={`platform-section site-home-section site-home-tone-${tone}`}
      aria-labelledby={titleId}
    >
      <div className="container platform-section-inner">
        {kicker ? <p className="site-home-kicker">{kicker}</p> : null}
        <h2 id={titleId} className="platform-section-title">
          {title}
        </h2>
        {lead ? <p className="platform-section-lead">{lead}</p> : null}
        {children}
      </div>
    </section>
  )
}
