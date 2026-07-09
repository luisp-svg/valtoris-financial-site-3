import { Link } from 'react-router-dom'
import HomeCardIcon from '../home/HomeCardIcon'

type DiagnosticIcon = 'grade' | 'picture' | 'protection'

type DiagnosticProductCardProps = {
  variant: 'family' | 'business' | 'protection'
  icon: DiagnosticIcon
  title: string
  valueProp: string
  timeEstimate: string
  primaryLabel: string
  primaryTo: string
  secondaryLabel: string
  secondaryTo: string
}

export default function DiagnosticProductCard({
  variant,
  icon,
  title,
  valueProp,
  timeEstimate,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: DiagnosticProductCardProps) {
  return (
    <article className={`diagnostic-product-card diagnostic-product-card--${variant}`}>
      <div className="diagnostic-product-card-top">
        <HomeCardIcon variant={icon} />
        <span className="diagnostic-product-card-time">{timeEstimate}</span>
      </div>
      <h3 className="diagnostic-product-card-title">{title}</h3>
      <p className="diagnostic-product-card-copy">{valueProp}</p>
      <div className="diagnostic-product-card-actions">
        <Link className="diagnostic-product-card-primary" to={primaryTo}>
          {primaryLabel}
        </Link>
        <Link className="diagnostic-product-card-secondary" to={secondaryTo}>
          {secondaryLabel}
        </Link>
      </div>
    </article>
  )
}
