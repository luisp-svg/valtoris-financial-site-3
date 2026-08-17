import { useEffect, useId, useRef, useState } from 'react'
import { boardMoveDestinationLabel } from './boardMovement'
import type { ProductionStage } from './types'

type ProductionBoardMoveMenuProps = {
  householdName: string
  destinations: ProductionStage[]
  disabled?: boolean
  onSelect: (stage: ProductionStage) => void
}

export default function ProductionBoardMoveMenu({
  householdName,
  destinations,
  disabled = false,
  onSelect,
}: ProductionBoardMoveMenuProps) {
  const buttonId = useId()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  if (destinations.length === 0) return null

  return (
    <div ref={rootRef} className="crm-production-board-move">
      <button
        id={buttonId}
        type="button"
        className="crm-production-board-notes-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Move ${householdName} to another stage`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((value) => !value)
        }}
      >
        Move to...
      </button>
      {open ? (
        <ul id={listId} className="crm-production-board-move-list" role="listbox" aria-labelledby={buttonId}>
          {destinations.map((stage) => (
            <li key={stage} role="presentation">
              <button
                type="button"
                role="option"
                className="crm-production-board-move-option"
                onClick={() => {
                  setOpen(false)
                  onSelect(stage)
                }}
              >
                {boardMoveDestinationLabel(stage)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
