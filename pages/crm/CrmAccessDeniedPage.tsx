import { useNavigate } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'

export default function CrmAccessDeniedPage() {
  const { email, profile, signOut } = useCrmAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/crm/login', { replace: true })
  }

  return (
    <div className="crm-access-denied">
      <h1>CRM access has not been provisioned</h1>
      <p>
        Your account is authenticated{email ? ` (${email})` : ''}, but it does not have an active
        owner or advisor CRM role.
      </p>
      {profile?.role ? (
        <p className="crm-access-denied-meta">
          Current profile role: <strong>{profile.role}</strong>
        </p>
      ) : (
        <p className="crm-access-denied-meta">
          No active CRM profile was found for this user. Profiles are created by invitation /
          bootstrap only — this app will not create one automatically.
        </p>
      )}
      <p>Contact a Valtoris owner to provision CRM access.</p>
      <button type="button" className="crm-login-submit" onClick={() => void handleLogout()}>
        Log out
      </button>
    </div>
  )
}
