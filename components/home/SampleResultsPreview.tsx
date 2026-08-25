type SampleBar = {
  label: string
  score: number
}

type SampleResultsPreviewProps = {
  compact?: boolean
  ariaLabel?: string
  badge?: string
  scoreLabel?: string
  gradeLabel?: string
  strongestLabel?: string
  priorityLabel?: string
  strongestValue?: string
  priorityValue?: string
  barsLabel?: string
  bars?: readonly SampleBar[]
  immediateTitle?: string
  plan30Title?: string
  plan90Title?: string
  immediateItems?: readonly string[]
  plan30Items?: readonly string[]
  plan90Items?: readonly string[]
  disclaimer?: string
}

const DEFAULT_BARS: SampleBar[] = [
  { label: 'Cash Flow', score: 88 },
  { label: 'Emergency Fund', score: 72 },
  { label: 'Debt Management', score: 65 },
  { label: 'Protection', score: 48 },
]

export default function SampleResultsPreview({
  compact = false,
  ariaLabel = 'Sample Family Financial Report Card preview',
  badge = 'Sample Report Preview',
  scoreLabel = 'Overall Score',
  gradeLabel = 'Grade',
  strongestLabel = 'Strongest Area',
  priorityLabel = 'Priority Area',
  strongestValue = 'Cash Flow',
  priorityValue = 'Protection',
  barsLabel = 'Sample category scores',
  bars = DEFAULT_BARS,
  immediateTitle = 'Immediate Priorities',
  plan30Title = '30-Day Action Plan',
  plan90Title = '90-Day Action Plan',
  immediateItems = ['Improve protection coverage', 'Increase emergency savings'],
  plan30Items = ['Review insurance', 'Build first emergency goal'],
  plan90Items = ['Complete estate planning', 'Increase retirement savings'],
  disclaimer = 'Illustrative sample only. Your personalized results will reflect your answers.',
}: SampleResultsPreviewProps) {
  return (
    <aside
      className={`sample-results-preview${compact ? ' sample-results-preview--compact' : ''}`}
      aria-label={ariaLabel}
    >
      <p className="sample-results-badge">{badge}</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">{scoreLabel}</p>
          <p className="sample-results-score-value">
            76 <span>/ 100</span>
          </p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">{gradeLabel}</p>
          <p className="sample-results-grade-value">C</p>
        </div>
      </div>

      <dl className="sample-results-meta">
        <div>
          <dt>{strongestLabel}</dt>
          <dd>{strongestValue}</dd>
        </div>
        <div>
          <dt>{priorityLabel}</dt>
          <dd>{priorityValue}</dd>
        </div>
      </dl>

      <div className="sample-results-bars" role="group" aria-label={barsLabel}>
        {bars.map((bar) => (
          <div key={bar.label} className="sample-results-bar-row">
            <div className="sample-results-bar-label">
              <span>{bar.label}</span>
              <span>{bar.score}</span>
            </div>
            <div
              className="sample-results-bar-track"
              role="progressbar"
              aria-valuenow={bar.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${bar.label}: ${bar.score} out of 100`}
            >
              <span className="sample-results-bar-fill" style={{ width: `${bar.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      {!compact ? (
        <div className="sample-results-plans">
          <article className="sample-results-plan-card">
            <h3 className="sample-results-side-title">{immediateTitle}</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {immediateItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="sample-results-plan-card">
            <h3 className="sample-results-side-title">{plan30Title}</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {plan30Items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="sample-results-plan-card">
            <h3 className="sample-results-side-title">{plan90Title}</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {plan90Items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      <p className="sample-results-disclaimer">{disclaimer}</p>
    </aside>
  )
}
