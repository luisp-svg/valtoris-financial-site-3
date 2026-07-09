const DIAGNOSTIC_PATHS = [
  {
    id: 'family',
    label: 'Family',
    product: 'Financial Report Card™',
    detail: 'Protection, cash flow, debt, retirement & legacy',
    icon: 'grade' as const,
  },
  {
    id: 'business',
    label: 'Business',
    product: 'Financial Report Card™',
    detail: 'Structure, cash flow, tax, risk & exit readiness',
    icon: 'picture' as const,
  },
  {
    id: 'protection',
    label: 'Protection',
    product: 'Family Protection Analysis™',
    detail: 'Life insurance needs & coverage gap estimate',
    icon: 'protection' as const,
  },
]

export default function PlatformHeroVisual() {
  return (
    <div className="platform-hero-visual" aria-hidden="true">
      <div className="platform-hero-visual-frame">
        <p className="platform-hero-visual-kicker">Three Diagnostics</p>
        <div className="platform-hero-visual-paths">
          {DIAGNOSTIC_PATHS.map((path) => (
            <div key={path.id} className={`platform-hero-visual-path platform-hero-visual-path--${path.id}`}>
              <span className={`home-card-icon home-card-icon-${path.icon} platform-hero-visual-icon`} />
              <div className="platform-hero-visual-path-copy">
                <span className="platform-hero-visual-path-label">{path.label}</span>
                <span className="platform-hero-visual-path-product">{path.product}</span>
                <span className="platform-hero-visual-path-detail">{path.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
