export type PriorityLevel = 'Critical' | 'Important' | 'Long-Term'

export type PriorityRecommendation = {
  level: PriorityLevel
  title: string
  why: string
  timeline: string
}

type PriorityRecommendationCardProps = PriorityRecommendation

export default function PriorityRecommendationCard({
  level,
  title,
  why,
  timeline,
}: PriorityRecommendationCardProps) {
  const levelClass = level.toLowerCase().replace('-', '')

  return (
    <article className={`priority-card priority-card-${levelClass}`}>
      <span className={`priority-badge priority-badge-${levelClass}`}>{level}</span>
      <h3 className="priority-title">{title}</h3>
      <div className="priority-detail">
        <span className="priority-detail-label">Why this matters</span>
        <p className="priority-detail-text">{why}</p>
      </div>
      <div className="priority-detail">
        <span className="priority-detail-label">Recommended timeline</span>
        <p className="priority-timeline">{timeline}</p>
      </div>
    </article>
  )
}
