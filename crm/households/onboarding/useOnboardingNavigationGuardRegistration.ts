import { useEffect } from 'react'
import { useOptionalCrmNavigationGuard } from '../../navigation/CrmNavigationGuardContext'

type Args = {
  enabled: boolean
  scopePathname: string
  isBlocked: boolean
  saveAndLeave: () => Promise<{ ok: true } | { ok: false; message: string }>
}

/**
 * Registers/unregisters the active CRM navigation guard for the onboarding route.
 * Clears registration on unmount so guards never linger.
 */
export function useOnboardingNavigationGuardRegistration({
  enabled,
  scopePathname,
  isBlocked,
  saveAndLeave,
}: Args) {
  const guard = useOptionalCrmNavigationGuard()

  useEffect(() => {
    if (!guard || !enabled) return
    guard.registerGuard({
      scopePathname,
      isBlocked,
      saveAndLeave,
    })
    return () => {
      guard.registerGuard(null)
    }
  }, [enabled, guard, isBlocked, saveAndLeave, scopePathname])
}
