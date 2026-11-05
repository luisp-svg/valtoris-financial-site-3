import type { HouseholdFinancialProgressResult } from '../../../financial-progress'
import {formatCategoriesCalculatedCaption,formatLastCalculated,formatProgressScoreValue,isOverallProgressAvailable,isProgressPlaceholder,PARTIAL_PROGRESS_MESSAGE,PLACEHOLDER_PROGRESS_MESSAGE} from './formatProgressDisplay'
import './progressPresentation.css'
type Props={progress:HouseholdFinancialProgressResult;onViewProgress?:()=>void}
/** A compact status and next step. Full calculation metadata lives in the detailed review. */
export default function FinancialProgressKpiCard({progress,onViewProgress}:Props){
 const placeholder=isProgressPlaceholder(progress),available=isOverallProgressAvailable(progress)
 return <article className={`crm-stat-card crm-financial-progress-kpi${!available?' is-placeholder':''}`} aria-label="Household Financial Progress"><h3 className="crm-stat-card-label">Household Financial Progress</h3>
  {available?<p className="crm-stat-card-value">{formatProgressScoreValue(progress.overall.score)}{progress.overall.grade&&<span className="crm-financial-progress-grade"> {progress.overall.grade}</span>}</p>:<><p className="crm-progress-pending-label">{placeholder?'Not calculated yet':'More information needed'}</p><p className="crm-stat-card-caption">{placeholder?PLACEHOLDER_PROGRESS_MESSAGE:PARTIAL_PROGRESS_MESSAGE}</p></>}
  <dl className="crm-financial-progress-kpi-meta"><div><dt>Review coverage</dt><dd>{formatCategoriesCalculatedCaption(progress)}</dd></div>{!placeholder&&<div><dt>Last updated</dt><dd>{formatLastCalculated(progress)}</dd></div>}</dl>
  {onViewProgress&&<button type="button" className="crm-text-btn crm-progress-view-button" onClick={onViewProgress}>View financial review →</button>}
 </article>
}
