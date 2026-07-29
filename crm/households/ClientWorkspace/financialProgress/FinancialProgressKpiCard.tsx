import type { HouseholdFinancialProgressResult } from '../../../financial-progress'
import {
  formatCategoriesCalculatedCaption,
  formatLastCalculated,
  formatProgressScoreValue,
  isOverallProgressAvailable,
  isProgressPartial,
  isProgressPlaceholder,
  PARTIAL_PROGRESS_MESSAGE,
  PLACEHOLDER_PROGRESS_MESSAGE,
} from './formatProgressDisplay'

type FinancialProgressKpiCardProps = {
  progress: HouseholdFinancialProgressResult
}

/** Header KPI for Household Financial Progress (engine-driven). */
export default function FinancialProgressKpiCard({ progress }: FinancialProgressKpiCardProps) {
  const placeholder = isProgressPlaceholder(progress)
  const overallAvailable = isOverallProgressAvailable(progress)
  const partial = isProgressPartial(progress)

  return (
    <article
      className={`crm-stat-card crm-financial-progress-kpi${placeholder || !overallAvailable ? ' is-placeholder' : ''}`}
      aria-label="Household Financial Progress"
    >
      <h3 className="crm-stat-card-label">Household Financial Progress</h3>

      {placeholder ? (
        <>
          <p className="crm-stat-card-value is-empty">Not Yet Calculated</p>
          <p className="crm-stat-card-caption">{PLACEHOLDER_PROGRESS_MESSAGE}</p>
          <dl className="crm-financial-progress-kpi-meta">
            <div>
              <dt>Methodology</dt>
              <dd>{progress.methodologyVersion}</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>{progress.engineVersion}</dd>
            </div>
          </dl>
        </>
      ) : overallAvailable ? (
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
              <dt>Categories</dt>
              <dd>{formatCategoriesCalculatedCaption(progress)}</dd>
            </div>
            <div>
              <dt>Last Calculated</dt>
              <dd>{formatLastCalculated(progress)}</dd>
            </div>
            <div>
              <dt>Methodology</dt>
              <dd>{progress.methodologyVersion}</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>{progress.engineVersion}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <p className="crm-stat-card-value is-empty">
            {partial ? 'Overall Score Withheld' : 'Overall Progress Not Yet Available'}
          </p>
          <p className="crm-stat-card-caption">{PARTIAL_PROGRESS_MESSAGE}</p>
          <dl className="crm-financial-progress-kpi-meta">
            <div>
              <dt>Categories</dt>
              <dd>{formatCategoriesCalculatedCaption(progress)}</dd>
            </div>
            <div>
              <dt>Last Calculated</dt>
              <dd>{formatLastCalculated(progress)}</dd>
            </div>
            <div>
              <dt>Methodology</dt>
              <dd>{progress.methodologyVersion}</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>{progress.engineVersion}</dd>
            </div>
          </dl>
        </>
      )}
    </article>
  )
}
