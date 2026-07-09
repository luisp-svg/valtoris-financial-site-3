import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import BrandWordmark from './BrandWordmark'

type AssessmentBrandHeaderProps = {
  className?: string
}

export default function AssessmentBrandHeader({ className = '' }: AssessmentBrandHeaderProps) {
  return (
    <Link
      to={ROUTES.home}
      className={`assessment-brand-header${className ? ` ${className}` : ''}`}
      aria-label="Valtoris Financial home"
    >
      <BrandWordmark variant="assessment" />
    </Link>
  )
}
