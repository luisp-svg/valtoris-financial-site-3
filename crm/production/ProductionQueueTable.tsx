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
} from './labels'
import { formatProductionDate, formatProductionDateTime } from './productionApi'
import PolicyLifecycleBadge from './PolicyLifecycleBadge'
import { policyLifecycleDisplayForApplication } from './policyLifecycle'
import StageBadge from './StageBadge'
import type { CrmSupportedRole } from '../types'
import type { CompensationViewer, ProductionApplicationListItem } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'
import { crmProductionEditPath, crmProductionPath } from '../../constants/routes'
import { canShowProductionEditAction } from './applicationEditView'

type ProductionQueueTableProps = {
  items: ProductionApplicationListItem[]
  viewer: CompensationViewer
  role?: CrmSupportedRole | null
  now?: Date
  hideCompensation?: boolean
}

export default function ProductionQueueTable({
  items,
  viewer,
  role = null,
  now,
  hideCompensation = false,
}: ProductionQueueTableProps) {
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
            <th scope="col">Policy status</th>
            <th scope="col">Days in stage</th>
            <th scope="col">App / policy #</th>
            <th scope="col">Submitted</th>
            {hideCompensation ? (
              <th scope="col">Amount</th>
            ) : (
              <>
                <th scope="col">Expected status</th>
                <th scope="col">Expected</th>
                <th scope="col">Review</th>
              </>
            )}
            <th scope="col">Updated</th>
            <th scope="col">Follow-up</th>
            <th scope="col">Delivery / disposition</th>
            <th scope="col">Actions</th>
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
            const attention = formatCaseAttentionLabels(caseAttentionFlags(item, asOf), item.product_line)
            const linked = getActiveLinkedPolicy(item)
            const policyNumber = linked?.policy_number ?? item.policy_number
            const expected = deriveExpectedListPresentation({
              viewer,
              productionStage: item.production_stage,
              liveRows: item.expected_compensations,
              writingAdvisorCount: countCurrentWritingAdvisors(item.allocations),
            })
            const amountCaption = listExpectedAmountCaption(expected)
            const showEdit = canShowProductionEditAction({
              role,
              stage: item.production_stage,
              deletedAt: item.deleted_at,
            })

            return (
              <tr key={item.id} className="crm-opportunities-row">
                <td>
                  <Link
                    to={crmProductionPath(item.id)}
                    className="crm-opportunities-name-link"
                  >
                    {item.household?.display_name?.trim() || 'Household'}
                  </Link>
                  <CaseAttentionFlagList labels={attention} />
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
                    {formatCaseProductLineLabel(item.product_line)}
                  </div>
                </td>
                <td>{getWritingAdvisorLabel(item)}</td>
                <td>{expected.split ? 'Split' : '—'}</td>
                <td>
                  <StageBadge stage={item.production_stage} />
                </td>
                <td>
                  {policyLifecycleDisplayForApplication(item) ? (
                    <PolicyLifecycleBadge status={getActiveLinkedPolicy(item)?.status} />
                  ) : (
                    '—'
                  )}
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
                {hideCompensation ? (
                  <td>{formatCaseAmount(item)}</td>
                ) : (
                  <>
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
                  </>
                )}
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
                <td>
                  {showEdit ? (
                    <Link
                      to={crmProductionEditPath(item.id)}
                      className="crm-production-edit-action"
                    >
                      Edit Application
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
