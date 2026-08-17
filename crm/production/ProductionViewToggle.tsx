import type { ProductionQueueViewMode } from './listLoadState'

type ProductionViewToggleProps = {
  value: ProductionQueueViewMode
  onChange: (next: ProductionQueueViewMode) => void
}

export default function ProductionViewToggle({ value, onChange }: ProductionViewToggleProps) {
  return (
    <div className="crm-production-view-toggle" role="group" aria-label="Production view">
      <button
        type="button"
        className={value === 'board' ? 'is-active' : undefined}
        aria-pressed={value === 'board'}
        onClick={() => onChange('board')}
      >
        Board
      </button>
      <button
        type="button"
        className={value === 'table' ? 'is-active' : undefined}
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
      >
        Table
      </button>
    </div>
  )
}
