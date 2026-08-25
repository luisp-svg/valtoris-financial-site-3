import { useEffect, useId, useRef } from 'react'
import PublicLink from './PublicLink'

type NavItem = {
  to: string
  label: string
}

type NavGroup = {
  id: string
  heading: string
  items: readonly NavItem[]
}

type SiteNavDropdownProps = {
  label: string
  items?: readonly NavItem[]
  groups?: readonly NavGroup[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SiteNavDropdown({
  label,
  items,
  groups,
  open,
  onOpenChange,
}: SiteNavDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const grouped = Boolean(groups && groups.length > 0)

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
      <div
        className={`site-nav-menu${grouped ? ' site-nav-menu--grouped' : ''}`}
        id={menuId}
        hidden={!open}
        role="menu"
      >
        {grouped
          ? groups?.map((group) => (
              <div key={group.id} className="site-nav-menu-group" role="group" aria-label={group.heading}>
                <p className="site-nav-menu-group-heading">{group.heading}</p>
                {group.items.map((item) => (
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
            ))
          : items?.map((item) => (
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
