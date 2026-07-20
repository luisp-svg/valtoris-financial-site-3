import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BrandLogo from '../../components/BrandLogo'
import BrandWordmark from '../../components/BrandWordmark'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'

export default function CrmLoginPage() {
  const { signIn, configError } = useCrmAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    const redirect = searchParams.get('redirect')
    const target =
      redirect && redirect.startsWith('/crm') && !redirect.startsWith('/crm/login')
        ? redirect
        : '/crm'
    navigate(target, { replace: true })
  }

  return (
    <div className="crm-login-page">
      <div className="crm-login-backdrop" aria-hidden="true" />
      <div className="crm-login-card">
        <div className="crm-login-brand">
          {!logoFailed ? (
            <BrandLogo className="crm-login-logo" onMissing={() => setLogoFailed(true)} />
          ) : (
            <BrandWordmark variant="assessment" />
          )}
          <h1 className="crm-login-title">Valtoris Financial</h1>
          <p className="crm-login-subtitle">Advisor CRM sign-in</p>
        </div>

        <form className="crm-login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <label className="crm-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label className="crm-field">
            <span>Password</span>
            <div className="crm-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="crm-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error || configError ? (
            <p className="crm-login-error" role="alert">
              {error || configError}
            </p>
          ) : null}

          <button type="submit" className="crm-login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="crm-login-note">Access is invite-only. Public registration is not available.</p>
      </div>
    </div>
  )
}
