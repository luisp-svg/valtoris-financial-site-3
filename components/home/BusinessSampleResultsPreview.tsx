const SAMPLE_BARS = [
  { label: 'Cash Flow', score: 82 },
  { label: 'Business Protection', score: 54 },
  { label: 'Tax Strategy', score: 68 },
  { label: 'Exit Planning', score: 41 },
]

const IMMEDIATE_PRIORITIES = [
  'Close key-person coverage gaps',
  'Strengthen operating cash reserves',
]

const PLAN_30_DAY = ['Review continuity coverage', 'Document cash reserve target']

const PLAN_90_DAY = ['Formalize succession outline', 'Improve business credit readiness']

export default function BusinessSampleResultsPreview() {
  return (
    <aside
      className="sample-results-preview"
      aria-label="Sample Business Financial Report Card preview"
    >
      <p className="sample-results-badge">Sample Report Preview</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">Overall Score</p>
          <p className="sample-results-score-value">
            71 <span>/ 100</span>
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
          <dd>Exit Planning</dd>
        </div>
      </dl>

      <div className="sample-results-bars" role="group" aria-label="Sample business category scores">
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

      <p className="sample-results-disclaimer">
        Illustrative sample only. Your personalized results will reflect your answers.
      </p>
    </aside>
  )
}
