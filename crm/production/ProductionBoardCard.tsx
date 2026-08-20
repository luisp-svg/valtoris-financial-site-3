import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../constants/routes'
import type { CrmSupportedRole } from '../types'
import { productionBoardCardMoney } from './boardCardMoney'
import CaseAttentionFlagList from './CaseAttentionFlagList'
import {
  caseAttentionFlags,
  formatCaseAttentionLabels,
  formatCaseProductLineLabel,
} from './caseWorkspace'
import { boardDraggableId, boardMoveDestinations } from './boardMovement'
import ProductionBoardMoveMenu from './ProductionBoardMoveMenu'
import {
  computeDaysInStage,
  getActiveLinkedPolicy,
  getInsuredOrAnnuitantLabel,
  getWritingAdvisorLabel,
  isFollowUpOverdue,
} from './daysInStage'
import StageBadge from './StageBadge'
import { formatCents, formatProductionDate } from './productionApi'
import type { ProductionApplicationListItem, ProductionStage } from './types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'

export type ProductionBoardNotesTarget = {
  householdId: string
  householdName: string
}

type ProductionBoardCardProps = {
  item: ProductionApplicationListItem
  now?: Date
  showStageBadge?: boolean
  role?: CrmSupportedRole | null
  enableDrag?: boolean
  movementBusy?: boolean
  onOpenNotes?: (target: ProductionBoardNotesTarget) => void
  onRequestMove?: (item: ProductionApplicationListItem, toStage: ProductionStage) => void
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
  role = null,
  enableDrag = false,
  movementBusy = false,
  onOpenNotes,
  onRequestMove,
}: ProductionBoardCardProps) {
  const asOf = now ?? new Date()
  const { days } = computeDaysInStage({
    productionStage: item.production_stage,
    stageHistory: item.stage_history,
    updatedAt: item.updated_at,
    now: asOf,
  })
  const stale = days >= PRODUCTION_STALE_DAYS_IN_STAGE
  const overdue = isFollowUpOverdue(item.next_follow_up_date, asOf)
  const attention = formatCaseAttentionLabels(caseAttentionFlags(item, asOf), item.product_line)
  const linked = getActiveLinkedPolicy(item)
  const policyNumber = linked?.policy_number ?? item.policy_number
  const householdName = item.household?.display_name?.trim() || 'Household'
  const destinations = boardMoveDestinations(item, role)
  const canMove = destinations.length > 0 && Boolean(onRequestMove)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: boardDraggableId(item.id),
    data: { applicationId: item.id },
    disabled: !enableDrag || !canMove || movementBusy,
  })

  return (
    <article
      className={`crm-production-board-card${isDragging ? ' is-dragging' : ''}`}
      data-stage={item.production_stage}
    >
      <Link to={crmProductionPath(item.id)} className="crm-production-board-card-link">
        <h4 className="crm-production-board-card-name">{householdName}</h4>
        <p className="crm-production-board-card-product">
          {item.carrier?.name ?? '—'} · {item.product?.name ?? '—'} ·{' '}
          {formatCaseProductLineLabel(item.product_line)}
        </p>
        {showStageBadge ? (
          <div className="crm-production-board-card-stage">
            <StageBadge stage={item.production_stage} />
          </div>
        ) : null}
        <CaseAttentionFlagList labels={attention} />
        <p className="crm-production-board-card-money">
          <BoardCardMoney item={item} />
        </p>
        <dl className="crm-production-board-card-meta">
          <div>
            <dt>Follow-up</dt>
            <dd className={overdue ? 'crm-production-overdue' : undefined}>
              {formatProductionDate(item.next_follow_up_date)}
              {overdue ? ' · overdue' : ''}
            </dd>
          </div>
          <div>
            <dt>Days in stage</dt>
            <dd>
              {days}
              {stale ? ` · ${PRODUCTION_STALE_DAYS_IN_STAGE}+` : ''}
            </dd>
          </div>
          <div>
            <dt>Insured / Annuitant</dt>
            <dd>{getInsuredOrAnnuitantLabel(item)}</dd>
          </div>
          <div>
            <dt>Advisor</dt>
            <dd>{getWritingAdvisorLabel(item)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{item.state || '—'}</dd>
          </div>
        </dl>
        <p className="crm-production-board-card-ids">
          App {item.application_number ?? '—'}
          {policyNumber ? ` · Policy ${policyNumber}` : ''}
        </p>
      </Link>
      <div className="crm-production-board-card-actions" onClick={(event) => event.stopPropagation()}>
        {enableDrag && canMove ? (
          <button
            ref={setNodeRef}
            type="button"
            className="crm-production-board-drag-handle"
            aria-label={`Drag to change stage for ${householdName}`}
            disabled={movementBusy}
            {...listeners}
            {...attributes}
            tabIndex={-1}
            onClick={(event) => event.preventDefault()}
          >
            Drag
          </button>
        ) : null}
        {canMove ? (
          <ProductionBoardMoveMenu
            householdName={householdName}
            destinations={destinations}
            disabled={movementBusy}
            onSelect={(stage) => onRequestMove?.(item, stage)}
          />
        ) : null}
        {onOpenNotes ? (
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
        ) : null}
      </div>
    </article>
  )
}
