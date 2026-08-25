import { useEffect, useId, useRef } from 'react'
import PublicLink from './PublicLink'

type SiteNavDropdownProps = {
  label: string
  items: readonly { to: string; label: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SiteNavDropdown({ label, items, open, onOpenChange }: SiteNavDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && !root.contains(event.target)) {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, onOpenChange])

  return (
    <div className={`site-nav-dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="site-nav-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        {label}
        <span className="site-nav-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="site-nav-menu" id={menuId} hidden={!open} role="menu">
        {items.map((item) => (
          <PublicLink
            key={`${item.to}-${item.label}`}
            className="site-nav-menu-link"
            to={item.to}
            role="menuitem"
            onClick={() => onOpenChange(false)}
          >
            {item.label}
          </PublicLink>
        ))}
      </div>
    </div>
  )
}
