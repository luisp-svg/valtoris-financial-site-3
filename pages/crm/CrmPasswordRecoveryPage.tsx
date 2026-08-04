import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../../components/BrandLogo'
import BrandWordmark from '../../components/BrandWordmark'
import { ROUTES } from '../../constants/routes'
import { passwordToggleAriaLabel, validateNewPassword } from '../../crm/auth/passwordPolicy'
import {
  clearSensitiveAuthUrlState,
  establishPasswordRecoverySession,
  mapUnexpectedRecoveryError,
  recoveryEstablishErrorMessage,
  submitPasswordRecovery,
  type RecoveryPageState,
} from '../../crm/auth/passwordRecovery'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function CrmPasswordRecoveryPage() {
  const [pageState, setPageState] = useState<RecoveryPageState>('checking')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const locationSnapshot = {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      }

      try {
        const supabase = createSupabaseBrowserClient()
        const result = await establishPasswordRecoverySession(supabase.auth, {
          search: locationSnapshot.search,
          hash: locationSnapshot.hash,
        })

        if (cancelled) return

        clearSensitiveAuthUrlState({
          pathname: locationSnapshot.pathname,
          search: window.location.search,
          hash: window.location.hash,
        })

        if (!result.ok) {
          setStatusMessage(recoveryEstablishErrorMessage(result.reason))
          setPageState('invalid')
          return
        }

        setStatusMessage(null)
        setPageState('ready')
      } catch {
        if (cancelled) return
        clearSensitiveAuthUrlState({
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
        })
        setStatusMessage(mapUnexpectedRecoveryError())
        setPageState('invalid')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submittingRef.current || pageState !== 'ready') return

    setFormError(null)
    const policy = validateNewPassword(password, confirmation)
    if (!policy.ok) {
      setFormError(policy.message)
      return
    }

    submittingRef.current = true
    setPageState('saving')

    try {
      const supabase = createSupabaseBrowserClient()
      const result = await submitPasswordRecovery({
        auth: supabase.auth,
        password,
        confirmation,
        isSubmitting: false,
      }, {
        clearUrl: () => {
          clearSensitiveAuthUrlState({
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
          })
        },
      })

      if (!result.ok) {
        if (result.blocked) return
        setFormError(result.message)
        setPageState('ready')
        submittingRef.current = false
        return
      }

      setPageState('success')
      setPassword('')
      setConfirmation('')
      // Full reload so CrmAuthProvider/CrmLoginGate do not treat the recovery
      // session as an already-authenticated bounce away from /crm/login.
      window.location.replace(result.redirectTo)
    } catch {
      setFormError(mapUnexpectedRecoveryError())
      setPageState('ready')
      submittingRef.current = false
    }
  }

  const formDisabled = pageState === 'saving' || pageState === 'success'

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
          <p className="crm-login-subtitle">Create your CRM password</p>
        </div>

        {pageState === 'checking' ? (
          <p className="crm-auth-status" role="status">
            Checking secure link…
          </p>
        ) : null}

        {pageState === 'invalid' ? (
          <div className="crm-recovery-invalid" role="alert">
            <p className="crm-login-error">{statusMessage}</p>
            <p className="crm-login-note">
              Open the latest invite or recovery email, or contact your administrator for a new
              link. Do not reuse an old link.
            </p>
            <Link className="crm-login-submit crm-recovery-link-button" to={ROUTES.crmLogin}>
              Back to sign in
            </Link>
          </div>
        ) : null}

        {pageState === 'ready' || pageState === 'saving' || pageState === 'success' ? (
          <form
            className="crm-login-form"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <p className="crm-recovery-intro">
              Choose a strong password for your advisor CRM account. You will sign in after it is
              saved.
            </p>

            <label className="crm-field">
              <span>New password</span>
              <div className="crm-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={formDisabled}
                  minLength={12}
                />
                <button
                  type="button"
                  className="crm-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-pressed={showPassword}
                  aria-label={passwordToggleAriaLabel('password', showPassword)}
                  disabled={formDisabled}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="crm-field">
              <span>Confirm password</span>
              <div className="crm-password-field">
                <input
                  type={showConfirmation ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  disabled={formDisabled}
                  minLength={12}
                />
                <button
                  type="button"
                  className="crm-password-toggle"
                  onClick={() => setShowConfirmation((value) => !value)}
                  aria-pressed={showConfirmation}
                  aria-label={passwordToggleAriaLabel('confirmation', showConfirmation)}
                  disabled={formDisabled}
                >
                  {showConfirmation ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {formError ? (
              <p className="crm-login-error" role="alert">
                {formError}
              </p>
            ) : null}

            <button type="submit" className="crm-login-submit" disabled={formDisabled}>
              {pageState === 'saving' ? 'Saving…' : 'Save password'}
            </button>
          </form>
        ) : null}

        {pageState === 'success' ? (
          <p className="crm-auth-status" role="status">
            Password saved. Redirecting to sign in…
          </p>
        ) : null}
      </div>
    </div>
  )
}
