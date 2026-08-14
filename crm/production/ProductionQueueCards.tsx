import { Link } from 'react-router-dom'
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
  formatProductionProductLineShort,
  formatProductionStageLabel,
} from './labels'
import { formatProductionDate } from './productionApi'
import type { ProductionApplicationListItem } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'
import { crmProductionPath } from '../../constants/routes'

type ProductionQueueCardsProps = {
  items: ProductionApplicationListItem[]
  now?: Date
}

export default function ProductionQueueCards({ items, now }: ProductionQueueCardsProps) {
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
        const linked = getActiveLinkedPolicy(item)

        return (
          <li key={item.id}>
            <article className="crm-opportunities-card">
              <Link to={crmProductionPath(item.id)} className="crm-opportunities-card-link">
                <h3 className="crm-opportunities-name">
                  {item.household?.display_name?.trim() || 'Household'}
                </h3>
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
                      {formatProductionProductLineShort(item.product_line)})
                    </dd>
                  </div>
                  <div>
                    <dt>Writing advisor</dt>
                    <dd>{getWritingAdvisorLabel(item)}</dd>
                  </div>
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
