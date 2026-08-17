import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../constants/routes'
import { productionBoardCardMoney } from './boardCardMoney'
import {
  computeDaysInStage,
  getActiveLinkedPolicy,
  getWritingAdvisorLabel,
} from './daysInStage'
import StageBadge from './StageBadge'
import { formatCents } from './productionApi'
import type { ProductionApplicationListItem } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'

export type ProductionBoardNotesTarget = {
  householdId: string
  householdName: string
}

type ProductionBoardCardProps = {
  item: ProductionApplicationListItem
  now?: Date
  showStageBadge?: boolean
  onOpenNotes?: (target: ProductionBoardNotesTarget) => void
}

function BoardCardMoney({ item }: { item: ProductionApplicationListItem }) {
  const money = productionBoardCardMoney(item)
  if (money.kind === 'fia') {
    return <>Annuity Deposit {formatCents(money.depositCents)}</>
  }
  if (money.kind === 'life') {
    return (
      <>
        Annual Life Premium {formatCents(money.annualPremiumCents)}
        {money.faceAmountCents != null ? ` · Face ${formatCents(money.faceAmountCents)}` : ''}
      </>
    )
  }
  return <>{'\u2014'}</>
}

export default function ProductionBoardCard({
  item,
  now,
  showStageBadge = false,
  onOpenNotes,
}: ProductionBoardCardProps) {
  const asOf = now ?? new Date()
  const { days } = computeDaysInStage({
    productionStage: item.production_stage,
    stageHistory: item.stage_history,
    updatedAt: item.updated_at,
    now: asOf,
  })
  const stale = days >= PRODUCTION_STALE_DAYS_IN_STAGE
  const linked = getActiveLinkedPolicy(item)
  const policyNumber = linked?.policy_number ?? item.policy_number
  const householdName = item.household?.display_name?.trim() || 'Household'

  return (
    <article className="crm-production-board-card" data-stage={item.production_stage}>
      <Link to={crmProductionPath(item.id)} className="crm-production-board-card-link">
        <h4 className="crm-production-board-card-name">{householdName}</h4>
        <p className="crm-production-board-card-product">
          {item.carrier?.name ?? '—'} · {item.product?.name ?? '—'}
        </p>
        <p className="crm-production-board-card-ids">
          App {item.application_number ?? '—'}
          {policyNumber ? ` · Policy ${policyNumber}` : ''}
        </p>
        <dl className="crm-production-board-card-meta">
          {showStageBadge ? (
            <div>
              <dt>Stage</dt>
              <dd>
                <StageBadge stage={item.production_stage} />
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Advisor</dt>
            <dd>{getWritingAdvisorLabel(item)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{item.state || '—'}</dd>
          </div>
          <div>
            <dt>Days in stage</dt>
            <dd>
              {days}
              {stale ? ` · ${PRODUCTION_STALE_DAYS_IN_STAGE}+` : ''}
            </dd>
          </div>
        </dl>
        <p className="crm-production-board-card-money">
          <BoardCardMoney item={item} />
        </p>
      </Link>
      {onOpenNotes ? (
        <div className="crm-production-board-card-actions">
          <button
            type="button"
            className="crm-production-board-notes-btn"
            aria-label={`Operational notes for ${householdName}`}
            onClick={() =>
              onOpenNotes({
                householdId: item.household_id,
                householdName,
              })
            }
          >
            Notes
          </button>
        </div>
      ) : null}
    </article>
  )
}
