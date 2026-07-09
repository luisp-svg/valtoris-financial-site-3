type BrandWordmarkVariant = 'header' | 'assessment'

type BrandWordmarkProps = {
  variant?: BrandWordmarkVariant
  className?: string
}

export default function BrandWordmark({
  variant = 'assessment',
  className = '',
}: BrandWordmarkProps) {
  return (
    <div
      className={`brand-wordmark brand-wordmark--${variant}${className ? ` ${className}` : ''}`}
      aria-label="Valtoris Financial"
    >
      <p className="brand-wordmark-valtoris">VALTORIS</p>
      <p className="brand-wordmark-financial">FINANCIAL</p>
    </div>
  )
}
