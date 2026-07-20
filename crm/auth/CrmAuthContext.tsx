import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { isCrmSupportedRole, type CrmProfile, type CrmSupportedRole } from '../types'

type CrmAuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'unprovisioned'

type CrmAuthContextValue = {
  status: CrmAuthStatus
  user: User | null
  profile: CrmProfile | null
  role: CrmSupportedRole | null
  email: string | null
  configError: string | null
  refresh: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const CrmAuthContext = createContext<CrmAuthContextValue | null>(null)

function mapProfile(row: Record<string, unknown> | null): CrmProfile | null {
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    email: String(row.email ?? ''),
    full_name: String(row.full_name ?? ''),
    role: row.role as CrmProfile['role'],
    is_active: Boolean(row.is_active),
  }
}

async function fetchCrmProfile(): Promise<CrmProfile | null> {
  const supabase = createSupabaseBrowserClient()

  // Prefer SECURITY DEFINER helper (active + non-deleted only).
  const { data: rpcData, error: rpcError } = await supabase.rpc('crm_current_profile')

  if (!rpcError && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    return mapProfile(row as Record<string, unknown>)
  }

  // Fallback: direct select of own profile (RLS). Do not insert/create rows.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
  return mapProfile(data as Record<string, unknown>)
}

export function CrmAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CrmAuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<CrmProfile | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      setConfigError(null)

      // Always validate with Auth server — do not trust local session alone.
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser()

      if (error || !authUser) {
        setUser(null)
        setProfile(null)
        setStatus('unauthenticated')
        return
      }

      setUser(authUser)
      const nextProfile = await fetchCrmProfile()
      setProfile(nextProfile)

      if (!nextProfile || !nextProfile.is_active || !isCrmSupportedRole(nextProfile.role)) {
        setStatus('unprovisioned')
        return
      }

      setStatus('authenticated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to initialize CRM authentication.'
      setConfigError(message)
      setUser(null)
      setProfile(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    void refresh()

    let subscription: { unsubscribe: () => void } | undefined
    try {
      const supabase = createSupabaseBrowserClient()
      const { data } = supabase.auth.onAuthStateChange((event) => {
        // Initial load is handled by refresh() above; avoid a double fetch loop.
        if (event === 'INITIAL_SESSION') return
        void refresh()
      })
      subscription = data.subscription
    } catch {
      // refresh() already surfaces config errors
    }

    return () => subscription?.unsubscribe()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        return { error: 'Invalid email or password. Please try again.' }
      }

      await refresh()
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.'
      return { error: message }
    }
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
    } finally {
      setUser(null)
      setProfile(null)
      setStatus('unauthenticated')
    }
  }, [])

  const role: CrmSupportedRole | null =
    profile && isCrmSupportedRole(profile.role) ? profile.role : null

  const value = useMemo<CrmAuthContextValue>(
    () => ({
      status,
      user,
      profile,
      role,
      email: user?.email ?? profile?.email ?? null,
      configError,
      refresh,
      signIn,
      signOut,
    }),
    [status, user, profile, role, configError, refresh, signIn, signOut],
  )

  return <CrmAuthContext.Provider value={value}>{children}</CrmAuthContext.Provider>
}

export function useCrmAuth(): CrmAuthContextValue {
  const ctx = useContext(CrmAuthContext)
  if (!ctx) {
    throw new Error('useCrmAuth must be used within CrmAuthProvider')
  }
  return ctx
}
