import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCrmAuth } from '../auth/CrmAuthContext'
import CrmShell from './CrmShell'
import CrmAccessDeniedPage from '../../pages/crm/CrmAccessDeniedPage'

export function CrmLoginGate() {
  const { status, configError } = useCrmAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="crm-auth-loading" role="status">
        <p>Checking your session…</p>
      </div>
    )
  }

  if (status === 'authenticated' || status === 'unprovisioned') {
    const redirect = new URLSearchParams(location.search).get('redirect')
    const target =
      status === 'authenticated' &&
      redirect &&
      redirect.startsWith('/crm') &&
      !redirect.startsWith('/crm/login')
        ? redirect
        : '/crm'
    return <Navigate to={target} replace />
  }

  if (configError) {
    return (
      <div className="crm-auth-loading" role="alert">
        <p>{configError}</p>
      </div>
    )
  }

  return <Outlet />
}

export function CrmProtectedGate() {
  const { status } = useCrmAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="crm-auth-loading" role="status">
        <p>Loading CRM…</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/crm/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  if (status === 'unprovisioned') {
    return (
      <div className="crm-unprovisioned-shell">
        <CrmAccessDeniedPage />
      </div>
    )
  }

  return (
    <CrmShell>
      <Outlet />
    </CrmShell>
  )
}
