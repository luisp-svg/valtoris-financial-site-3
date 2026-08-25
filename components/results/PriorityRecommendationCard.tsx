export type PriorityLevel = 'Critical' | 'Important' | 'Long-Term'

export type PriorityRecommendation = {
  level: PriorityLevel
  title: string
  why: string
  timeline: string
  impact?: string
}

type PriorityRecommendationCardProps = PriorityRecommendation & {
  rank?: number
  featured?: boolean
  impactLabel?: string
  whyLabel?: string
  timelineLabel?: string
  rankLabel?: string
  levelLabel?: string
}

export default function PriorityRecommendationCard({
  level,
  title,
  why,
  timeline,
  impact,
  rank,
  featured = false,
  impactLabel = 'Expected impact',
  whyLabel = 'Why this matters',
  timelineLabel = 'Recommended timeline',
  rankLabel = 'Priority #{rank}',
  levelLabel,
}: PriorityRecommendationCardProps) {
  const levelClass = level.toLowerCase().replace('-', '')

  return (
    <article
      className={`priority-card priority-card-${levelClass}${featured ? ' priority-card-featured' : ''}`}
    >
      {rank ? (
        <span className="priority-rank-label">{rankLabel.replace('{rank}', String(rank))}</span>
      ) : null}
      <span className={`priority-badge priority-badge-${levelClass}`}>{levelLabel ?? level}</span>
      <h3 className="priority-title">{title}</h3>
      <div className="priority-detail">
        <span className="priority-detail-label">{whyLabel}</span>
        <p className="priority-detail-text">{why}</p>
      </div>
      {impact ? (
        <div className="priority-detail">
          <span className="priority-detail-label">{impactLabel}</span>
          <p className="priority-detail-text">{impact}</p>
        </div>
      ) : null}
      <div className="priority-detail">
        <span className="priority-detail-label">{timelineLabel}</span>
        <p className="priority-timeline">{timeline}</p>
      </div>
    </article>
  )
}
