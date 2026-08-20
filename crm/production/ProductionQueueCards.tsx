import { Link } from 'react-router-dom'
import CaseAttentionFlagList from './CaseAttentionFlagList'
import {
  caseAttentionFlags,
  formatCaseAmount,
  formatCaseAttentionLabels,
  formatCaseProductLineLabel,
} from './caseWorkspace'
import CompensationStatusBadge from './CompensationStatusBadge'
import {
  countCurrentWritingAdvisors,
  deriveExpectedListPresentation,
  formatListExpectedAmount,
  listExpectedAmountCaption,
} from './compensationView'
import {
  computeDaysInStage,
  getActiveLinkedPolicy,
  getInsuredOrAnnuitantLabel,
  getWritingAdvisorLabel,
  isFollowUpOverdue,
  isStaleDaysInStage,
} from './daysInStage'
import {
  formatProductionDeliveryLabel,
  formatProductionDispositionLabel,
  formatProductionStageLabel,
} from './labels'
import { formatProductionDate } from './productionApi'
import type { CompensationViewer, ProductionApplicationListItem } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'
import { crmProductionPath } from '../../constants/routes'

type ProductionQueueCardsProps = {
  items: ProductionApplicationListItem[]
  viewer: CompensationViewer
  now?: Date
  hideCompensation?: boolean
}

export default function ProductionQueueCards({
  items,
  viewer,
  now,
  hideCompensation = false,
}: ProductionQueueCardsProps) {
  const asOf = now ?? new Date()

  return (
    <ul className="crm-opportunities-card-list" aria-label="Production queue cards">
      {items.map((item) => {
        const { days } = computeDaysInStage({
          productionStage: item.production_stage,
          stageHistory: item.stage_history,
          updatedAt: item.updated_at,
          now: asOf,
        })
        const stale = isStaleDaysInStage(days)
            const overdue = isFollowUpOverdue(item.next_follow_up_date, asOf)
            const attention = formatCaseAttentionLabels(caseAttentionFlags(item, asOf), item.product_line)
            const linked = getActiveLinkedPolicy(item)
        const expected = deriveExpectedListPresentation({
          viewer,
          productionStage: item.production_stage,
          liveRows: item.expected_compensations,
          writingAdvisorCount: countCurrentWritingAdvisors(item.allocations),
        })
        const amountCaption = listExpectedAmountCaption(expected)

        return (
          <li key={item.id}>
            <article className="crm-opportunities-card">
              <Link to={crmProductionPath(item.id)} className="crm-opportunities-card-link">
                <h3 className="crm-opportunities-name">
                  {item.household?.display_name?.trim() || 'Household'}
                </h3>
                <CaseAttentionFlagList labels={attention} />
                <dl className="crm-opportunities-card-meta">
                  <div>
                    <dt>Stage</dt>
                    <dd>{formatProductionStageLabel(item.production_stage)}</dd>
                  </div>
                  <div>
                    <dt>Days in stage</dt>
                    <dd>
                      {days}
                      {stale ? ` · ${PRODUCTION_STALE_DAYS_IN_STAGE}+ days in stage` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Follow-up</dt>
                    <dd className={overdue ? 'crm-production-overdue' : undefined}>
                      {formatProductionDate(item.next_follow_up_date)}
                      {overdue ? ' (overdue)' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Insured / Annuitant</dt>
                    <dd>{getInsuredOrAnnuitantLabel(item)}</dd>
                  </div>
                  <div>
                    <dt>Carrier / product</dt>
                    <dd>
                      {item.carrier?.name ?? '—'} · {item.product?.name ?? '—'} (
                      {formatCaseProductLineLabel(item.product_line)})
                    </dd>
                  </div>
                  <div>
                    <dt>Writing advisor</dt>
                    <dd>
                      {getWritingAdvisorLabel(item)}
                      {expected.split ? ' · Split' : ''}
                    </dd>
                  </div>
                  {hideCompensation ? (
                    <div>
                      <dt>Amount</dt>
                      <dd>{formatCaseAmount(item)}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Expected</dt>
                      <dd>
                        <CompensationStatusBadge status={expected.status} review={expected.review} />
                        <div className="crm-production-money">
                          {formatListExpectedAmount(expected)}
                        </div>
                        {amountCaption ? <div className="crm-muted">{amountCaption}</div> : null}
                        {expected.review ? <div>Review</div> : null}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Delivery / disposition</dt>
                    <dd>
                      {formatProductionDeliveryLabel(item.delivery_status)} /{' '}
                      {formatProductionDispositionLabel(item.underwriting_disposition)}
                    </dd>
                  </div>
                </dl>
                <div className="crm-opportunities-card-footer">
                  {linked ? <span className="crm-production-linked-pill">Linked policy</span> : null}
                  <span className="crm-muted">
                    App {item.application_number ?? '—'}
                    {linked?.policy_number || item.policy_number
                      ? ` · Policy ${linked?.policy_number ?? item.policy_number}`
                      : ''}
                  </span>
                </div>
              </Link>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
