import { formatCurrency, ProtectionBreakdown } from './calculations'

type ProtectionTierCardProps = {
  title: string
  description: string
  includes: string[]
  breakdown: ProtectionBreakdown
  featured?: boolean
  badge?: string
}

export default function ProtectionTierCard({
  title,
  description,
  includes,
  breakdown,
  featured = false,
  badge,
}: ProtectionTierCardProps) {
  return (
    <article className={`protection-tier-card${featured ? ' is-featured' : ''}`}>
      {badge && <span className="protection-tier-badge">{badge}</span>}
      <h3 className="protection-tier-title">
        {title}
        {featured && <span aria-hidden="true"> ⭐</span>}
      </h3>
      <p className="protection-tier-description">{description}</p>
      <div className="protection-tier-includes">
        <span className="protection-tier-includes-label">Includes</span>
        <ul>
          {includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="protection-tier-amount">
        <span className="protection-tier-amount-label">Coverage Amount</span>
        <span className="protection-tier-amount-value">{formatCurrency(breakdown.total)}</span>
        {breakdown.netNeed < breakdown.total && (
          <span className="protection-tier-net">
            Estimated gap after existing coverage: {formatCurrency(breakdown.netNeed)}
          </span>
        )}
      </div>
    </article>
  )
}
