type AssessmentBrandHeaderProps = {
  className?: string
}

export default function AssessmentBrandHeader({ className = '' }: AssessmentBrandHeaderProps) {
  return (
    <div
      className={`assessment-brand-header${className ? ` ${className}` : ''}`}
      aria-label="Valtoris Financial"
    >
      <div className="assessment-brand-wordmark">
        <p className="assessment-brand-valtoris">VALTORIS</p>
        <p className="assessment-brand-financial">FINANCIAL</p>
      </div>
    </div>
  )
}
