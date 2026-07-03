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
}

export default function PriorityRecommendationCard({
  level,
  title,
  why,
  timeline,
  impact,
  rank,
  featured = false,
}: PriorityRecommendationCardProps) {
  const levelClass = level.toLowerCase().replace('-', '')

  return (
    <article
      className={`priority-card priority-card-${levelClass}${featured ? ' priority-card-featured' : ''}`}
    >
      {rank ? <span className="priority-rank-label">Priority #{rank}</span> : null}
      <span className={`priority-badge priority-badge-${levelClass}`}>{level}</span>
      <h3 className="priority-title">{title}</h3>
      <div className="priority-detail">
        <span className="priority-detail-label">Why this matters</span>
        <p className="priority-detail-text">{why}</p>
      </div>
      {impact ? (
        <div className="priority-detail">
          <span className="priority-detail-label">Expected impact</span>
          <p className="priority-detail-text">{impact}</p>
        </div>
      ) : null}
      <div className="priority-detail">
        <span className="priority-detail-label">Recommended timeline</span>
        <p className="priority-timeline">{timeline}</p>
      </div>
    </article>
  )
}
