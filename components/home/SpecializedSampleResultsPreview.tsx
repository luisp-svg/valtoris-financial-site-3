import { useId } from 'react'

export type SpecializedSampleBar = {
  readonly label: string
  readonly score: number
}

export type SpecializedSampleFlag = {
  readonly badge: string
  readonly title: string
}

export type SpecializedSampleArea = {
  readonly title: string
}

export type SpecializedSampleResultsPreviewProps = {
  readonly ariaLabel: string
  readonly badge: string
  readonly scoreLabel: string
  readonly score: number
  readonly gradeLabel: string
  readonly grade: string
  readonly statusLabel: string
  readonly status: string
  readonly barsLabel: string
  readonly bars: readonly SpecializedSampleBar[]
  readonly flagHeading: string
  readonly flag: SpecializedSampleFlag
  readonly reviewHeading: string
  readonly reviewAreas: readonly SpecializedSampleArea[]
  readonly disclaimer: string
}

export default function SpecializedSampleResultsPreview({
  ariaLabel,
  badge,
  scoreLabel,
  score,
  gradeLabel,
  grade,
  statusLabel,
  status,
  barsLabel,
  bars,
  flagHeading,
  flag,
  reviewHeading,
  reviewAreas,
  disclaimer,
}: SpecializedSampleResultsPreviewProps) {
  const flagHeadingId = useId()

  return (
    <aside className="sample-results-preview" aria-label={ariaLabel}>
      <p className="sample-results-badge">{badge}</p>

      <div className="sample-results-score-panel">
        <div className="sample-results-score-block">
          <p className="sample-results-score-label">{scoreLabel}</p>
          <p className="sample-results-score-value">
            {score} <span>/ 100</span>
          </p>
        </div>
        <div className="sample-results-grade-block">
          <p className="sample-results-score-label">{gradeLabel}</p>
          <p className="sample-results-grade-value">{grade}</p>
          <p className="sample-results-status">
            {statusLabel}: {status}
          </p>
        </div>
      </div>

      <div className="sample-results-flag" aria-labelledby={flagHeadingId}>
        <p className="sample-results-side-title" id={flagHeadingId}>
          {flagHeading}
        </p>
        <p className="sample-results-flag-badge">{flag.badge}</p>
        <p className="sample-results-flag-title">{flag.title}</p>
      </div>

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
          <h3 className="sample-results-side-title">{reviewHeading}</h3>
          <ul className="sample-results-plan-list sample-results-plan-list--bullets">
            {reviewAreas.map((area) => (
              <li key={area.title}>{area.title}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="sample-results-disclaimer">{disclaimer}</p>
    </aside>
  )
}
