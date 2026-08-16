import { Link } from 'react-router-dom'
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
  formatProductionProductLineShort,
} from './labels'
import { formatProductionDate, formatProductionDateTime } from './productionApi'
import StageBadge from './StageBadge'
import type { CompensationViewer, ProductionApplicationListItem } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'
import { crmProductionPath } from '../../constants/routes'

type ProductionQueueTableProps = {
  items: ProductionApplicationListItem[]
  viewer: CompensationViewer
  now?: Date
}

export default function ProductionQueueTable({ items, viewer, now }: ProductionQueueTableProps) {
  const asOf = now ?? new Date()

  return (
    <div className="crm-opportunities-table-wrap" role="region" aria-label="Production queue table">
      <table className="crm-opportunities-table">
        <thead>
          <tr>
            <th scope="col">Household</th>
            <th scope="col">Insured / Annuitant</th>
            <th scope="col">Carrier</th>
            <th scope="col">Product</th>
            <th scope="col">Writing advisor</th>
            <th scope="col">Split</th>
            <th scope="col">Stage</th>
            <th scope="col">Days in stage</th>
            <th scope="col">App / policy #</th>
            <th scope="col">Submitted</th>
            <th scope="col">Expected status</th>
            <th scope="col">Expected</th>
            <th scope="col">Review</th>
            <th scope="col">Updated</th>
            <th scope="col">Follow-up</th>
            <th scope="col">Delivery / disposition</th>
          </tr>
        </thead>
        <tbody>
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
            const policyNumber = linked?.policy_number ?? item.policy_number
            const expected = deriveExpectedListPresentation({
              viewer,
              productionStage: item.production_stage,
              liveRows: item.expected_compensations,
              writingAdvisorCount: countCurrentWritingAdvisors(item.allocations),
            })
            const amountCaption = listExpectedAmountCaption(expected)

            return (
              <tr key={item.id} className="crm-opportunities-row">
                <td>
                  <Link
                    to={crmProductionPath(item.id)}
                    className="crm-opportunities-name-link"
                  >
                    {item.household?.display_name?.trim() || 'Household'}
                  </Link>
                  {linked ? (
                    <span className="crm-production-linked-pill" title="Linked issued policy">
                      Linked policy
                    </span>
                  ) : null}
                </td>
                <td>{getInsuredOrAnnuitantLabel(item)}</td>
                <td>{item.carrier?.name ?? '—'}</td>
                <td>
                  <div>{item.product?.name ?? '—'}</div>
                  <div className="crm-muted">
                    {formatProductionProductLineShort(item.product_line)}
                  </div>
                </td>
                <td>{getWritingAdvisorLabel(item)}</td>
                <td>{expected.split ? 'Split' : '—'}</td>
                <td>
                  <StageBadge stage={item.production_stage} />
                </td>
                <td>
                  {days}
                  {stale ? (
                    <div className="crm-production-stale-note">
                      {PRODUCTION_STALE_DAYS_IN_STAGE}+ days in stage
                    </div>
                  ) : null}
                </td>
                <td>
                  <div>{item.application_number ?? '—'}</div>
                  <div className="crm-muted">{policyNumber ?? '—'}</div>
                </td>
                <td>{formatProductionDate(item.submission_date)}</td>
                <td>
                  <CompensationStatusBadge status={expected.status} review={expected.review} />
                </td>
                <td className="crm-production-money">
                  {formatListExpectedAmount(expected)}
                  {amountCaption ? (
                    <div className="crm-muted">{amountCaption}</div>
                  ) : null}
                </td>
                <td>{expected.review ? 'Review' : '—'}</td>
                <td>{formatProductionDateTime(item.updated_at)}</td>
                <td>
                  <span className={overdue ? 'crm-production-overdue' : undefined}>
                    {formatProductionDate(item.next_follow_up_date)}
                  </span>
                  {overdue ? <div className="crm-production-stale-note">Follow-up overdue</div> : null}
                </td>
                <td>
                  <div>{formatProductionDeliveryLabel(item.delivery_status)}</div>
                  <div className="crm-muted">
                    {formatProductionDispositionLabel(item.underwriting_disposition)}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
