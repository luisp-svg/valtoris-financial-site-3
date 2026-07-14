const SAMPLE_BARS = [
  { label: 'Cash Flow', score: 88 },
  { label: 'Emergency Fund', score: 72 },
  { label: 'Debt Management', score: 65 },
  { label: 'Protection', score: 48 },
]

const IMMEDIATE_PRIORITIES = [
  'Improve protection coverage',
  'Increase emergency savings',
]

const PLAN_30_DAY = ['Review insurance', 'Build first emergency goal']

const PLAN_90_DAY = ['Complete estate planning', 'Increase retirement savings']

type SampleResultsPreviewProps = {
  compact?: boolean
}

export default function SampleResultsPreview({ compact = false }: SampleResultsPreviewProps) {
  return (
    <aside
      className={`sample-results-preview${compact ? ' sample-results-preview--compact' : ''}`}
      aria-label="Sample Family Financial Report Card preview"
    >
      <p className="sample-results-badge">Sample Report Preview</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">Overall Score</p>
          <p className="sample-results-score-value">
            76 <span>/ 100</span>
          </p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">Grade</p>
          <p className="sample-results-grade-value">C</p>
        </div>
      </div>

      <dl className="sample-results-meta">
        <div>
          <dt>Strongest Area</dt>
          <dd>Cash Flow</dd>
        </div>
        <div>
          <dt>Priority Area</dt>
          <dd>Protection</dd>
        </div>
      </dl>

      <div className="sample-results-bars" role="group" aria-label="Sample category scores">
        {SAMPLE_BARS.map((bar) => (
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
            <h3 className="sample-results-side-title">Immediate Priorities</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {IMMEDIATE_PRIORITIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="sample-results-plan-card">
            <h3 className="sample-results-side-title">30-Day Action Plan</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {PLAN_30_DAY.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="sample-results-plan-card">
            <h3 className="sample-results-side-title">90-Day Action Plan</h3>
            <ul className="sample-results-plan-list sample-results-plan-list--bullets">
              {PLAN_90_DAY.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      <p className="sample-results-disclaimer">
        Illustrative sample only. Your personalized results will reflect your answers.
      </p>
    </aside>
  )
}
