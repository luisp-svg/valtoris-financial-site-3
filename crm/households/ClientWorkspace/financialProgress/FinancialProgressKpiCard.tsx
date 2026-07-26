import type { HouseholdFinancialProgressResult } from '../../../financial-progress'
import {
  formatLastCalculated,
  formatProgressScoreValue,
  isProgressPlaceholder,
} from './formatProgressDisplay'

type FinancialProgressKpiCardProps = {
  progress: HouseholdFinancialProgressResult
}

/** Header KPI for Household Financial Progress (engine-driven). */
export default function FinancialProgressKpiCard({ progress }: FinancialProgressKpiCardProps) {
  const placeholder = isProgressPlaceholder(progress)

  return (
    <article
      className={`crm-stat-card crm-financial-progress-kpi${placeholder ? ' is-placeholder' : ''}`}
      aria-label="Household Financial Progress"
    >
      <h3 className="crm-stat-card-label">Household Financial Progress</h3>

      {placeholder ? (
        <>
          <p className="crm-stat-card-value is-empty">Not Yet Calculated</p>
          <p className="crm-stat-card-caption">
            Complete household assessment to generate score.
          </p>
        </>
      ) : (
        <>
          <p className="crm-stat-card-value">
            {formatProgressScoreValue(progress.overall.score)}
            {progress.overall.grade ? (
              <span className="crm-financial-progress-grade"> {progress.overall.grade}</span>
            ) : null}
          </p>
          <dl className="crm-financial-progress-kpi-meta">
            <div>
              <dt>Grade</dt>
              <dd>{progress.overall.grade ?? '—'}</dd>
            </div>
            <div>
              <dt>Last Calculated</dt>
              <dd>{formatLastCalculated(progress)}</dd>
            </div>
            <div>
              <dt>Methodology</dt>
              <dd>{progress.methodologyVersion}</dd>
            </div>
          </dl>
        </>
      )}
    </article>
  )
}
