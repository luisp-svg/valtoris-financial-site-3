import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { CrmSupportedRole } from '../types'
import ProductionBoardCard, { type ProductionBoardNotesTarget } from './ProductionBoardCard'
import {
  boardDroppableId,
  isLegalBoardMove,
  parseBoardDraggableApplicationId,
  resolveBoardDropDestination,
} from './boardMovement'
import {
  BOARD_PIPELINE_COLUMNS,
  defaultMobileBoardFocus,
  groupProductionBoardItems,
  isBoardPipelineStage,
  boardLaneForStage,
  mobileFocusHeading,
  type MobileBoardFocus,
  type ProductionBoardColumn,
  type ProductionBoardLayout,
} from './boardView'
import type { ProductionApplicationListItem, ProductionStage } from './types'

type ProductionBoardProps = {
  items: ProductionApplicationListItem[]
  layout: ProductionBoardLayout
  stageFilter?: ProductionStage[] | 'all'
  now?: Date
  role?: CrmSupportedRole | null
  movementBusy?: boolean
  focusStage?: ProductionStage | null
  onOpenNotes?: (target: ProductionBoardNotesTarget) => void
  onRequestMove?: (item: ProductionApplicationListItem, toStage: ProductionStage) => void
}

function BoardColumn({
  column,
  now,
  showStageBadge,
  role,
  enableDrag,
  movementBusy,
  activeItem,
  onOpenNotes,
  onRequestMove,
}: {
  column: ProductionBoardColumn
  now?: Date
  showStageBadge?: boolean
  role?: CrmSupportedRole | null
  enableDrag: boolean
  movementBusy: boolean
  activeItem: ProductionApplicationListItem | null
  onOpenNotes?: (target: ProductionBoardNotesTarget) => void
  onRequestMove?: (item: ProductionApplicationListItem, toStage: ProductionStage) => void
}) {
  const legal =
    activeItem != null && isLegalBoardMove(activeItem, column.stage, role ?? null)
  const isOrigin = activeItem?.production_stage === column.stage
  const unavailable = activeItem != null && !isOrigin && !legal
  const { setNodeRef, isOver } = useDroppable({
    id: boardDroppableId(column.stage),
    data: { stage: column.stage },
    disabled: !enableDrag || movementBusy || (activeItem != null && !legal),
  })
  const className = [
    'crm-production-board-column',
    isOver && legal ? 'is-drop-over' : '',
    legal ? 'is-drop-allowed' : '',
    unavailable ? 'is-drop-unavailable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      ref={setNodeRef}
      className={className}
      data-stage={column.stage}
      aria-labelledby={`pp-board-${column.stage}`}
    >
      <header className="crm-production-board-column-head">
        <h3 id={`pp-board-${column.stage}`}>{column.label}</h3>
        <span className="crm-production-board-count">{column.items.length}</span>
      </header>
      {legal ? (
        <p className="crm-production-board-drop-hint">
          {isOver ? `Drop to move to ${column.label}` : `Can move to ${column.label}`}
        </p>
      ) : null}
      {unavailable ? (
        <p className="crm-production-board-drop-hint">Not a valid next stage</p>
      ) : null}
      {column.items.length === 0 ? (
        <p className="crm-muted crm-production-board-empty">No applications</p>
      ) : (
        <ul className="crm-production-board-card-list">
          {column.items.map((item) => (
            <li key={item.id}>
              <ProductionBoardCard
                item={item}
                now={now}
                showStageBadge={showStageBadge}
                role={role}
                enableDrag={enableDrag}
                movementBusy={movementBusy}
                onOpenNotes={onOpenNotes}
                onRequestMove={onRequestMove}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ProductionBoard({
  items,
  layout,
  stageFilter = 'all',
  now,
  role = null,
  movementBusy = false,
  focusStage = null,
  onOpenNotes,
  onRequestMove,
}: ProductionBoardProps) {
  const model = useMemo(() => groupProductionBoardItems(items), [items])
  const derivedFocus = useMemo(
    () => defaultMobileBoardFocus(model, stageFilter),
    [model, stageFilter],
  )
  const [focus, setFocus] = useState<MobileBoardFocus>(derivedFocus)
  const [activeId, setActiveId] = useState<string | null>(null)
  const enableDrag = layout === 'horizontal' && Boolean(onRequestMove)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  const sensors = useSensors(pointerSensor)
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const activeItem = activeId ? (itemsById.get(activeId) ?? null) : null

  useEffect(() => {
    setFocus(derivedFocus)
  }, [derivedFocus])

  useEffect(() => {
    if (!focusStage) return
    const lane = boardLaneForStage(focusStage)
    if (lane === 'pipeline' && isBoardPipelineStage(focusStage)) {
      setFocus({ kind: 'pipeline', stage: focusStage })
      return
    }
    if (lane === 'intake') setFocus({ kind: 'intake' })
    else setFocus({ kind: 'exceptions' })
  }, [focusStage])

  const stackedColumns =
    focus.kind === 'intake'
      ? model.intake
      : focus.kind === 'exceptions'
        ? model.exceptions
        : model.pipeline.filter((column) => column.stage === focus.stage)

  function onStackedTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const current = tabs.indexOf(event.target as HTMLButtonElement)
    if (current < 0) return

    let nextIndex = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (current + 1) % tabs.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (current - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    }
    if (nextIndex < 0) return
    event.preventDefault()
    tabs[nextIndex]?.focus()
    tabs[nextIndex]?.click()
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(parseBoardDraggableApplicationId(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    const destination = resolveBoardDropDestination({
      activeId: event.active.id,
      overId: event.over?.id,
      items,
      role,
    })
    setActiveId(null)
    if (!destination || !onRequestMove) return
    const item = itemsById.get(destination.item.id)
    if (!item) return
    onRequestMove(item, destination.toStage)
  }

  function onDragCancel() {
    setActiveId(null)
  }

  const boardBody =
    layout === 'stacked' ? (
      <div className="crm-production-board is-stacked" aria-label="Production board" aria-busy={movementBusy || undefined}>
        <div
          className="crm-production-board-tabs"
          role="tablist"
          aria-label="Board stages"
          onKeyDown={onStackedTabKeyDown}
        >
          {BOARD_PIPELINE_COLUMNS.map((column) => {
            const count = model.pipeline.find((row) => row.stage === column.stage)?.items.length ?? 0
            const selected = focus.kind === 'pipeline' && focus.stage === column.stage
            return (
              <button
                key={column.stage}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={selected ? 'is-active' : undefined}
                onClick={() => setFocus({ kind: 'pipeline', stage: column.stage })}
              >
                {column.label}
                <span className="crm-production-board-count">{count}</span>
              </button>
            )
          })}
          <button
            type="button"
            role="tab"
            aria-selected={focus.kind === 'intake'}
            tabIndex={focus.kind === 'intake' ? 0 : -1}
            className={focus.kind === 'intake' ? 'is-active' : undefined}
            onClick={() => setFocus({ kind: 'intake' })}
          >
            Intake
            <span className="crm-production-board-count">{model.intakeCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={focus.kind === 'exceptions'}
            tabIndex={focus.kind === 'exceptions' ? 0 : -1}
            className={focus.kind === 'exceptions' ? 'is-active' : undefined}
            onClick={() => setFocus({ kind: 'exceptions' })}
          >
            Exceptions
            <span className="crm-production-board-count">{model.exceptionCount}</span>
          </button>
        </div>
        <div
          role="tabpanel"
          aria-labelledby={
            focus.kind === 'pipeline' ? `pp-board-${focus.stage}` : 'pp-board-mobile-heading'
          }
        >
          {focus.kind !== 'pipeline' ? (
            <h3 id="pp-board-mobile-heading">{mobileFocusHeading(focus)}</h3>
          ) : null}
          {stackedColumns.map((column) => (
            <BoardColumn
              key={column.stage}
              column={column}
              now={now}
              showStageBadge={focus.kind !== 'pipeline'}
              role={role}
              enableDrag={false}
              movementBusy={movementBusy}
              activeItem={null}
              onOpenNotes={onOpenNotes}
              onRequestMove={onRequestMove}
            />
          ))}
        </div>
      </div>
    ) : (
      <div
        className={`crm-production-board is-horizontal${activeId ? ' is-dnd-active' : ''}`}
        aria-label="Production board"
        aria-busy={movementBusy || undefined}
      >
        <div
          className="crm-production-board-pipeline"
          role="region"
          aria-label="Primary pipeline"
          tabIndex={0}
        >
          {model.pipeline.map((column) => (
            <BoardColumn
              key={column.stage}
              column={column}
              now={now}
              role={role}
              enableDrag={enableDrag}
              movementBusy={movementBusy}
              activeItem={activeItem}
              onOpenNotes={onOpenNotes}
              onRequestMove={onRequestMove}
            />
          ))}
        </div>
        <details className="crm-production-board-rail" open={model.intakeCount > 0}>
          <summary>
            Intake / Application Drafts
            <span className="crm-production-board-count">{model.intakeCount}</span>
          </summary>
          <div className="crm-production-board-rail-columns">
            {model.intake.map((column) => (
              <BoardColumn
                key={column.stage}
                column={column}
                now={now}
                showStageBadge
                role={role}
                enableDrag={enableDrag}
                movementBusy={movementBusy}
                activeItem={activeItem}
                onOpenNotes={onOpenNotes}
                onRequestMove={onRequestMove}
              />
            ))}
          </div>
        </details>
        <details className="crm-production-board-rail" open={model.exceptionCount > 0}>
          <summary>
            Exceptions
            <span className="crm-production-board-count">{model.exceptionCount}</span>
          </summary>
          <div className="crm-production-board-rail-columns">
            {model.exceptions.map((column) => (
              <BoardColumn
                key={column.stage}
                column={column}
                now={now}
                showStageBadge
                role={role}
                enableDrag={enableDrag}
                movementBusy={movementBusy}
                activeItem={activeItem}
                onOpenNotes={onOpenNotes}
                onRequestMove={onRequestMove}
              />
            ))}
          </div>
        </details>
      </div>
    )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {boardBody}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="crm-production-board-card is-drag-overlay" data-stage={activeItem.production_stage}>
            <p className="crm-production-board-card-name">
              {activeItem.household?.display_name?.trim() || 'Household'}
            </p>
            <p className="crm-production-board-card-product">
              Moving from {activeItem.production_stage.replace(/_/g, ' ')}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
