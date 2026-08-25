type SampleBar = {
  label: string
  score: number
}

/** Optional localized labels. Defaults keep the existing English sample copy. */
type RetirementSampleResultsPreviewProps = {
  ariaLabel?: string
  badge?: string
  scoreLabel?: string
  gradeLabel?: string
  readinessLabel?: string
  strongestLabel?: string
  priorityLabel?: string
  retirementAgeLabel?: string
  monthlyNeedLabel?: string
  monthlyIncomeLabel?: string
  monthlyGapLabel?: string
  fundedRatioLabel?: string
  barsLabel?: string
  bars?: SampleBar[]
  immediateTitle?: string
  plan30Title?: string
  plan90Title?: string
  immediateItems?: string[]
  plan30Items?: string[]
  plan90Items?: string[]
  disclaimer?: string
}

const DEFAULT_BARS: SampleBar[] = [
  { label: 'Savings Progress', score: 78 },
  { label: 'Income Sources', score: 64 },
  { label: 'Income Sustainability', score: 58 },
  { label: 'Investments', score: 71 },
]

const DEFAULT_IMMEDIATE_PRIORITIES = [
  'Confirm Social Security estimates',
  'Review the projected retirement-income gap',
]

const DEFAULT_PLAN_30_DAY = [
  'Increase contributions by 2%',
  'Consolidate retirement account information',
  'Review investment risk',
]

const DEFAULT_PLAN_90_DAY = [
  'Build a written retirement-income strategy',
  'Evaluate tax-diversification opportunities',
  'Complete healthcare and estate-planning review',
]

export default function RetirementSampleResultsPreview({
  ariaLabel = 'Sample Retirement Report Card preview',
  badge = 'Sample Report Preview',
  scoreLabel = 'Overall Score',
  gradeLabel = 'Grade',
  readinessLabel = 'Important Gaps to Address',
  strongestLabel = 'Strongest Area',
  priorityLabel = 'Priority Area',
  retirementAgeLabel = 'Retirement Age',
  monthlyNeedLabel = 'Projected Monthly Need',
  monthlyIncomeLabel = 'Estimated Monthly Income',
  monthlyGapLabel = 'Estimated Monthly Gap',
  fundedRatioLabel = 'Funded Ratio',
  barsLabel = 'Sample retirement category scores',
  bars = DEFAULT_BARS,
  immediateTitle = 'Immediate Priorities',
  plan30Title = '30-Day Action Plan',
  plan90Title = '90-Day Action Plan',
  immediateItems = DEFAULT_IMMEDIATE_PRIORITIES,
  plan30Items = DEFAULT_PLAN_30_DAY,
  plan90Items = DEFAULT_PLAN_90_DAY,
  disclaimer = 'Illustrative sample only. Your personalized results will reflect your answers. These estimates do not guarantee retirement outcomes.',
}: RetirementSampleResultsPreviewProps = {}) {
  const strongestValue = bars[0]?.label ?? DEFAULT_BARS[0].label
  const priorityValue = bars[2]?.label ?? DEFAULT_BARS[2].label

  return (
    <aside className="sample-results-preview" aria-label={ariaLabel}>
      <p className="sample-results-badge">{badge}</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">{scoreLabel}</p>
          <p className="sample-results-score-value">
            72 <span>/ 100</span>
          </p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">{gradeLabel}</p>
          <p className="sample-results-grade-value">C</p>
        </div>
      </div>

      <p className="sample-results-readiness">{readinessLabel}</p>

      <dl className="sample-results-meta">
        <div>
          <dt>{strongestLabel}</dt>
          <dd>{strongestValue}</dd>
        </div>
        <div>
          <dt>{priorityLabel}</dt>
          <dd>{priorityValue}</dd>
        </div>
        <div>
          <dt>{retirementAgeLabel}</dt>
          <dd>65</dd>
        </div>
        <div>
          <dt>{monthlyNeedLabel}</dt>
          <dd>$7,200</dd>
        </div>
        <div>
          <dt>{monthlyIncomeLabel}</dt>
          <dd>$6,050</dd>
        </div>
        <div>
          <dt>{monthlyGapLabel}</dt>
          <dd>$1,150</dd>
        </div>
        <div>
          <dt>{fundedRatioLabel}</dt>
          <dd>84%</dd>
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
