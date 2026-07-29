import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  beginSaveAndLeave,
  cancelUnsavedDialog,
  completeSaveAndLeave,
  createIdleUnsavedDialogState,
  failSaveAndLeave,
  openUnsavedDialog,
  shouldInterceptInternalNavigation,
  type UnsavedNavigationDialogState,
} from './navigationGuardUtils'

export type CrmNavigationGuardRegistration = {
  /** Exact pathname that is guarded (no query), e.g. /crm/households/:id/onboarding */
  scopePathname: string
  isBlocked: boolean
  /** Persist then resolve true on success. Must not navigate itself. */
  saveAndLeave: () => Promise<{ ok: true } | { ok: false; message: string }>
}

type CrmNavigationGuardContextValue = {
  registerGuard: (registration: CrmNavigationGuardRegistration | null) => void
  /** Programmatic leave (Exit buttons). Honors the same dialog. */
  requestNavigation: (to: string) => void
}

const CrmNavigationGuardContext = createContext<CrmNavigationGuardContextValue | null>(null)

type ProviderProps = {
  children: ReactNode
  /** Element that receives capture-phase click interception (CRM shell root). */
  rootRef: React.RefObject<HTMLElement | null>
}

export function CrmNavigationGuardProvider({ children, rootRef }: ProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const registrationRef = useRef<CrmNavigationGuardRegistration | null>(null)
  const [registrationVersion, setRegistrationVersion] = useState(0)
  const [dialog, setDialog] = useState<UnsavedNavigationDialogState>(createIdleUnsavedDialogState())
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const headingId = useId()
  const bodyId = useId()

  const registerGuard = useCallback((next: CrmNavigationGuardRegistration | null) => {
    registrationRef.current = next
    setRegistrationVersion((value) => value + 1)
  }, [])

  const openForDestination = useCallback((to: string) => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialog((prev) => openUnsavedDialog(prev, to))
  }, [])

  const requestNavigation = useCallback(
    (to: string) => {
      const reg = registrationRef.current
      if (!reg?.isBlocked) {
        navigate(to)
        return
      }
      try {
        const url = new URL(to, window.location.origin)
        if (
          url.pathname === reg.scopePathname ||
          (url.pathname === location.pathname && location.pathname === reg.scopePathname)
        ) {
          // Staying inside guarded onboarding path — allow.
          navigate(to)
          return
        }
      } catch {
        navigate(to)
        return
      }
      openForDestination(to)
    },
    [location.pathname, navigate, openForDestination],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onClickCapture = (event: MouseEvent) => {
      const reg = registrationRef.current
      if (!reg?.isBlocked) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return

      const decision = shouldInterceptInternalNavigation({
        event,
        anchor,
        origin: window.location.origin,
        currentPathname: location.pathname,
        scopePathname: reg.scopePathname,
        isBlocked: reg.isBlocked,
      })
      if (!decision.intercept) return

      event.preventDefault()
      event.stopPropagation()
      openForDestination(decision.to)
    }

    root.addEventListener('click', onClickCapture, true)
    return () => root.removeEventListener('click', onClickCapture, true)
  }, [location.pathname, openForDestination, registrationVersion, rootRef])

  useEffect(() => {
    if (!dialog.open) return
    const frame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialog.saving) {
        event.preventDefault()
        setDialog(cancelUnsavedDialog())
        previouslyFocusedRef.current?.focus?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dialog.open, dialog.saving])

  const onCancel = () => {
    if (dialog.saving) return
    setDialog(cancelUnsavedDialog())
    previouslyFocusedRef.current?.focus?.()
  }

  const onLeaveWithoutSaving = () => {
    if (dialog.saving || !dialog.pendingTo) return
    const to = dialog.pendingTo
    setDialog(cancelUnsavedDialog())
    navigate(to)
  }

  const onSaveAndLeave = async () => {
    const reg = registrationRef.current
    const pendingTo = dialog.pendingTo
    if (!reg || !pendingTo || dialog.saving) return

    setDialog((prev) => beginSaveAndLeave(prev))
    const result = await reg.saveAndLeave()
    if (!result.ok) {
      setDialog((prev) => failSaveAndLeave(prev, result.message))
      return
    }
    setDialog(completeSaveAndLeave())
    navigate(pendingTo)
  }

  const value = useMemo(
    () => ({ registerGuard, requestNavigation }),
    [registerGuard, requestNavigation],
  )

  return (
    <CrmNavigationGuardContext.Provider value={value}>
      {children}
      {dialog.open ? (
        <div className="crm-nav-guard-overlay" role="presentation">
          <div
            className="crm-nav-guard-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={bodyId}
          >
            <h2 id={headingId} className="crm-panel-title">
              Unsaved onboarding changes
            </h2>
            <p id={bodyId} className="crm-muted">
              You have changes that have not been saved. Save your draft before leaving, leave
              without saving, or return to onboarding.
            </p>
            {dialog.error ? (
              <div className="crm-banner crm-banner-error" role="alert">
                <p>{dialog.error}</p>
              </div>
            ) : null}
            <div className="crm-nav-guard-actions">
              <button
                type="button"
                className="crm-primary-btn"
                disabled={dialog.saving}
                onClick={() => void onSaveAndLeave()}
              >
                {dialog.saving ? 'Saving…' : 'Save and leave'}
              </button>
              <button
                type="button"
                className="crm-secondary-btn"
                disabled={dialog.saving}
                onClick={onLeaveWithoutSaving}
              >
                Leave without saving
              </button>
              <button
                ref={cancelButtonRef}
                type="button"
                className="crm-text-btn"
                disabled={dialog.saving}
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CrmNavigationGuardContext.Provider>
  )
}

export function useCrmNavigationGuard(): CrmNavigationGuardContextValue {
  const value = useContext(CrmNavigationGuardContext)
  if (!value) {
    throw new Error('useCrmNavigationGuard must be used within CrmNavigationGuardProvider')
  }
  return value
}

/** Optional access when a component may render outside the CRM shell. */
export function useOptionalCrmNavigationGuard(): CrmNavigationGuardContextValue | null {
  return useContext(CrmNavigationGuardContext)
}
