import BrandWordmark from './BrandWordmark'

type AssessmentBrandHeaderProps = {
  className?: string
}

export default function AssessmentBrandHeader({ className = '' }: AssessmentBrandHeaderProps) {
  return (
    <div
      className={`assessment-brand-header${className ? ` ${className}` : ''}`}
    >
      <BrandWordmark variant="assessment" />
    </div>
  )
}
