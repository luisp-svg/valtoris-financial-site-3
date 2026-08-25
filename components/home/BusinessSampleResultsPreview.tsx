type SampleBar = {
  label: string
  score: number
}

type BusinessSampleResultsPreviewProps = {
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
  { label: 'Cash Flow', score: 82 },
  { label: 'Business Protection', score: 54 },
  { label: 'Tax Strategy', score: 68 },
  { label: 'Exit Planning', score: 41 },
]

export default function BusinessSampleResultsPreview({
  ariaLabel = 'Sample Business Financial Report Card preview',
  badge = 'Sample Report Preview',
  scoreLabel = 'Overall Score',
  gradeLabel = 'Grade',
  strongestLabel = 'Strongest Area',
  priorityLabel = 'Priority Area',
  strongestValue = 'Cash Flow',
  priorityValue = 'Exit Planning',
  barsLabel = 'Sample business category scores',
  bars = DEFAULT_BARS,
  immediateTitle = 'Immediate Priorities',
  plan30Title = '30-Day Action Plan',
  plan90Title = '90-Day Action Plan',
  immediateItems = ['Close key-person coverage gaps', 'Strengthen operating cash reserves'],
  plan30Items = ['Review continuity coverage', 'Document cash reserve target'],
  plan90Items = ['Formalize succession outline', 'Improve business credit readiness'],
  disclaimer = 'Illustrative sample only. Your personalized results will reflect your answers.',
}: BusinessSampleResultsPreviewProps) {
  return (
    <aside className="sample-results-preview" aria-label={ariaLabel}>
      <p className="sample-results-badge">{badge}</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">{scoreLabel}</p>
          <p className="sample-results-score-value">
            71 <span>/ 100</span>
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

      <p className="sample-results-disclaimer">{disclaimer}</p>
    </aside>
  )
}
