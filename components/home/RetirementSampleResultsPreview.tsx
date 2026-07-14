const SAMPLE_BARS = [
  { label: 'Savings Progress', score: 78 },
  { label: 'Income Sources', score: 64 },
  { label: 'Income Sustainability', score: 58 },
  { label: 'Investments', score: 71 },
]

const IMMEDIATE_PRIORITIES = [
  'Confirm Social Security estimates',
  'Review the projected retirement-income gap',
]

const PLAN_30_DAY = [
  'Increase contributions by 2%',
  'Consolidate retirement account information',
  'Review investment risk',
]

const PLAN_90_DAY = [
  'Build a written retirement-income strategy',
  'Evaluate tax-diversification opportunities',
  'Complete healthcare and estate-planning review',
]

export default function RetirementSampleResultsPreview() {
  return (
    <aside
      className="sample-results-preview"
      aria-label="Sample Retirement Report Card preview"
    >
      <p className="sample-results-badge">Sample Report Preview</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">Overall Score</p>
          <p className="sample-results-score-value">
            72 <span>/ 100</span>
          </p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">Grade</p>
          <p className="sample-results-grade-value">C</p>
        </div>
      </div>

      <p className="sample-results-readiness">Important Gaps to Address</p>

      <dl className="sample-results-meta">
        <div>
          <dt>Strongest Area</dt>
          <dd>Savings Progress</dd>
        </div>
        <div>
          <dt>Priority Area</dt>
          <dd>Income Sustainability</dd>
        </div>
        <div>
          <dt>Retirement Age</dt>
          <dd>65</dd>
        </div>
        <div>
          <dt>Projected Monthly Need</dt>
          <dd>$7,200</dd>
        </div>
        <div>
          <dt>Estimated Monthly Income</dt>
          <dd>$6,050</dd>
        </div>
        <div>
          <dt>Estimated Monthly Gap</dt>
          <dd>$1,150</dd>
        </div>
        <div>
          <dt>Funded Ratio</dt>
          <dd>84%</dd>
        </div>
      </dl>

      <div className="sample-results-bars" role="group" aria-label="Sample retirement category scores">
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
        Illustrative sample only. Your personalized results will reflect your answers. These
        estimates do not guarantee retirement outcomes.
      </p>
    </aside>
  )
}
