type ProtectionSampleResultsPreviewProps = {
  /** Optional localized copy. Defaults keep the existing English preview. */
  ariaLabel?: string
  badge?: string
  coverageLabel?: string
  currentCoverageLabel?: string
  gapLabel?: string
  gapNote?: string
  prioritiesTitle?: string
  priorities?: readonly string[]
  disclaimer?: string
}

const DEFAULT_PRIORITIES = [
  'Confirm income replacement needs',
  'Review mortgage and debt coverage',
  'Align education funding with family goals',
]

export default function ProtectionSampleResultsPreview({
  ariaLabel = 'Sample Family Protection Analysis preview',
  badge = 'Sample Report Preview',
  coverageLabel = 'Coverage Needed',
  currentCoverageLabel = 'Current Coverage',
  gapLabel = 'Protection Gap',
  gapNote = 'Additional estimated protection your family may still need.',
  prioritiesTitle = 'Priority Recommendations',
  priorities = DEFAULT_PRIORITIES,
  disclaimer = 'Illustrative sample only. Your personalized results will reflect your answers.',
}: ProtectionSampleResultsPreviewProps) {
  return (
    <aside className="sample-results-preview protection-sample-results" aria-label={ariaLabel}>
      <p className="sample-results-badge">{badge}</p>

      <div className="sample-results-score-panel protection-sample-metrics">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">{coverageLabel}</p>
          <p className="sample-results-score-value protection-sample-metric-value">$1.09M</p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">{currentCoverageLabel}</p>
          <p className="sample-results-score-value protection-sample-metric-value">$250K</p>
        </div>
      </div>

      <div className="protection-sample-gap-panel">
        <p className="sample-results-score-label">{gapLabel}</p>
        <p className="protection-sample-gap-value">$840,000</p>
        <p className="protection-sample-gap-note">{gapNote}</p>
      </div>

      <div className="sample-results-plans">
        <article className="sample-results-plan-card">
          <h3 className="sample-results-side-title">{prioritiesTitle}</h3>
          <ul className="sample-results-plan-list sample-results-plan-list--bullets">
            {priorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="sample-results-disclaimer">{disclaimer}</p>
    </aside>
  )
}
