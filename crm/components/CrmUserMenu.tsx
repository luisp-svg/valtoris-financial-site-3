import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrmAuth } from '../auth/CrmAuthContext'

export default function CrmUserMenu() {
  const { email, role, signOut } = useCrmAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await signOut()
    navigate('/crm/login', { replace: true })
  }

  return (
    <div className="crm-user-menu" ref={rootRef}>
      <button
        type="button"
        className="crm-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="crm-user-menu-email">{email ?? 'Account'}</span>
        {role ? <span className="crm-user-menu-role">{role}</span> : null}
      </button>

      {open ? (
        <div className="crm-user-menu-panel" role="menu">
          <div className="crm-user-menu-meta">
            <p className="crm-user-menu-meta-label">Signed in</p>
            <p className="crm-user-menu-meta-value">{email}</p>
            {role ? <p className="crm-user-menu-meta-role">CRM role: {role}</p> : null}
          </div>
          <button type="button" className="crm-user-menu-logout" role="menuitem" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
