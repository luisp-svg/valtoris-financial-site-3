const PRIORITY_RECOMMENDATIONS = [
  'Confirm income replacement needs',
  'Review mortgage and debt coverage',
  'Align education funding with family goals',
]

export default function ProtectionSampleResultsPreview() {
  return (
    <aside
      className="sample-results-preview protection-sample-results"
      aria-label="Sample Family Protection Analysis preview"
    >
      <p className="sample-results-badge">Sample Report Preview</p>

      <div className="sample-results-score-panel protection-sample-metrics">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">Coverage Needed</p>
          <p className="sample-results-score-value protection-sample-metric-value">$1.09M</p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">Current Coverage</p>
          <p className="sample-results-score-value protection-sample-metric-value">$250K</p>
        </div>
      </div>

      <div className="protection-sample-gap-panel">
        <p className="sample-results-score-label">Protection Gap</p>
        <p className="protection-sample-gap-value">$840,000</p>
        <p className="protection-sample-gap-note">
          Additional estimated protection your family may still need.
        </p>
      </div>

      <div className="sample-results-plans">
        <article className="sample-results-plan-card">
          <h3 className="sample-results-side-title">Priority Recommendations</h3>
          <ul className="sample-results-plan-list sample-results-plan-list--bullets">
            {PRIORITY_RECOMMENDATIONS.map((item) => (
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
