import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import ProductionBoardCard from './ProductionBoardCard'
import {
  BOARD_PIPELINE_COLUMNS,
  defaultMobileBoardFocus,
  groupProductionBoardItems,
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
}

function BoardColumn({
  column,
  now,
  showStageBadge,
}: {
  column: ProductionBoardColumn
  now?: Date
  showStageBadge?: boolean
}) {
  return (
    <section
      className="crm-production-board-column"
      data-stage={column.stage}
      aria-labelledby={`pp-board-${column.stage}`}
    >
      <header className="crm-production-board-column-head">
        <h3 id={`pp-board-${column.stage}`}>{column.label}</h3>
        <span className="crm-production-board-count">{column.items.length}</span>
      </header>
      {column.items.length === 0 ? (
        <p className="crm-muted crm-production-board-empty">No applications</p>
      ) : (
        <ul className="crm-production-board-card-list">
          {column.items.map((item) => (
            <li key={item.id}>
              <ProductionBoardCard item={item} now={now} showStageBadge={showStageBadge} />
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
}: ProductionBoardProps) {
  const model = useMemo(() => groupProductionBoardItems(items), [items])
  const derivedFocus = useMemo(
    () => defaultMobileBoardFocus(model, stageFilter),
    [model, stageFilter],
  )
  const [focus, setFocus] = useState<MobileBoardFocus>(derivedFocus)

  useEffect(() => {
    setFocus(derivedFocus)
  }, [derivedFocus])

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

  if (layout === 'stacked') {
    return (
      <div className="crm-production-board is-stacked" aria-label="Production board">
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
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="crm-production-board is-horizontal" aria-label="Production board">
      <div
        className="crm-production-board-pipeline"
        role="region"
        aria-label="Primary pipeline"
        tabIndex={0}
      >
        {model.pipeline.map((column) => (
          <BoardColumn key={column.stage} column={column} now={now} />
        ))}
      </div>
      <details className="crm-production-board-rail" open={model.intakeCount > 0}>
        <summary>
          Intake / Application Drafts
          <span className="crm-production-board-count">{model.intakeCount}</span>
        </summary>
        <div className="crm-production-board-rail-columns">
          {model.intake.map((column) => (
            <BoardColumn key={column.stage} column={column} now={now} showStageBadge />
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
            <BoardColumn key={column.stage} column={column} now={now} showStageBadge />
          ))}
        </div>
      </details>
    </div>
  )
}
