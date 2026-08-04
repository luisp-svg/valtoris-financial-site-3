import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js'
import { validateNewPassword } from './passwordPolicy'

export const CRM_PASSWORD_RECOVERY_PATH = '/crm/auth/recovery'
export const CRM_LOGIN_PASSWORD_UPDATED_QUERY = 'passwordUpdated=1'
export const CRM_LOGIN_AFTER_PASSWORD_PATH = `/crm/login?${CRM_LOGIN_PASSWORD_UPDATED_QUERY}`

export const PASSWORD_UPDATED_BANNER = 'Password created. Sign in to continue.'

export type RecoveryPageState =
  | 'checking'
  | 'ready'
  | 'saving'
  | 'success'
  | 'invalid'

export type RecoveryEstablishResult =
  | { ok: true; source: 'existing_session' | 'pkce' | 'password_recovery' }
  | { ok: false; reason: 'missing' | 'exchange_failed' | 'expired' }

type AuthLike = Pick<
  SupabaseClient['auth'],
  | 'exchangeCodeForSession'
  | 'verifyOtp'
  | 'setSession'
  | 'getUser'
  | 'getSession'
  | 'onAuthStateChange'
  | 'updateUser'
  | 'signOut'
>

const SAFE_INVALID_LINK =
  'This invite or recovery link is invalid or has expired. Request a new link from your administrator.'
const SAFE_EXCHANGE_FAILED =
  'We could not verify this secure link. Request a new invite or recovery email and try again.'
const SAFE_UPDATE_FAILED =
  'We could not save your password. Please try again or request a new link.'
const SAFE_GENERIC = 'Something went wrong. Please try again with a new secure link.'

/** Query/hash keys that must never be left in the address bar after handling. */
const SENSITIVE_QUERY_KEYS = [
  'code',
  'token',
  'token_hash',
  'access_token',
  'refresh_token',
  'type',
  'error',
  'error_code',
  'error_description',
] as const

export type RecoveryFailureReason = Extract<RecoveryEstablishResult, { ok: false }>['reason']

export function recoveryEstablishErrorMessage(reason: RecoveryFailureReason): string {
  if (reason === 'exchange_failed') return SAFE_EXCHANGE_FAILED
  if (reason === 'expired') return SAFE_INVALID_LINK
  return SAFE_INVALID_LINK
}

export function mapPasswordUpdateError(): string {
  return SAFE_UPDATE_FAILED
}

export function mapUnexpectedRecoveryError(): string {
  return SAFE_GENERIC
}

/**
 * Strip sensitive auth params from the current URL without navigating away.
 * Call only after Supabase has consumed auth state, or on a terminal failure.
 */
export function clearSensitiveAuthUrlState(
  location: { pathname: string; search: string; hash: string },
  replaceState: (url: string) => void = (url) => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', url)
    }
  },
): void {
  const params = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search)
  let changed = false
  for (const key of SENSITIVE_QUERY_KEYS) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  const nextSearch = params.toString()
  const nextHash = ''
  const hadHash = Boolean(location.hash && location.hash !== '#')
  if (!changed && !hadHash) return

  const url = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
  replaceState(url)
}

export function extractPkceCode(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const code = params.get('code')
  if (!code || !code.trim()) return null
  return code
}

export function extractEmailOtpFromSearch(search: string): {
  token_hash: string
  type: 'invite' | 'recovery' | 'magiclink' | 'email'
} | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const token_hash = params.get('token_hash') || params.get('token')
  const type = params.get('type')
  if (!token_hash?.trim() || !type) return null
  if (type !== 'invite' && type !== 'recovery' && type !== 'magiclink' && type !== 'email') {
    return null
  }
  return { token_hash, type }
}

export function hasImplicitAuthHash(hash: string): boolean {
  if (!hash || hash === '#') return false
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return Boolean(
    params.get('access_token') ||
      params.get('refresh_token') ||
      params.get('type') === 'recovery' ||
      params.get('type') === 'invite' ||
      params.get('type') === 'magiclink',
  )
}

export function extractImplicitSessionFromHash(hash: string): {
  access_token: string
  refresh_token: string
  type: string | null
} | null {
  if (!hash || hash === '#') return null
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return null
  return {
    access_token,
    refresh_token,
    type: params.get('type'),
  }
}

function isExpiredAuthMessage(message: string | undefined): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('expired') ||
    lower.includes('otp_expired') ||
    lower.includes('flow_state_expired') ||
    lower.includes('invalid flow state') ||
    lower.includes('already been used')
  )
}

/**
 * Establish an invite/recovery session using the existing browser Supabase client.
 * Does not trust query params alone — requires a verified user via getUser().
 */
export async function establishPasswordRecoverySession(
  auth: AuthLike,
  location: { search: string; hash: string },
  options?: { settleMs?: number },
): Promise<RecoveryEstablishResult> {
  const settleMs = options?.settleMs ?? 2500
  let sawPasswordRecovery = false
  const code = extractPkceCode(location.search)
  const emailOtp = extractEmailOtpFromSearch(location.search)
  const hadImplicitHash = hasImplicitAuthHash(location.hash)
  const hadAuthMarker = Boolean(code) || Boolean(emailOtp) || hadImplicitHash

  const { data: listener } = auth.onAuthStateChange((event: AuthChangeEvent) => {
    if (event === 'PASSWORD_RECOVERY') {
      sawPasswordRecovery = true
    }
  })

  try {
    if (emailOtp) {
      let user = await requireVerifiedUser(auth)
      if (!user) {
        const { error } = await auth.verifyOtp({
          type: emailOtp.type,
          token_hash: emailOtp.token_hash,
        })
        user = await requireVerifiedUser(auth)
        if (!user) {
          if (error && isExpiredAuthMessage(error.message)) {
            return { ok: false, reason: 'expired' }
          }
          return { ok: false, reason: error ? 'exchange_failed' : 'expired' }
        }
      }
      return {
        ok: true,
        source: emailOtp.type === 'recovery' || sawPasswordRecovery ? 'password_recovery' : 'pkce',
      }
    }

    if (code) {
      // detectSessionInUrl may already have consumed the PKCE code on client init.
      let user = await requireVerifiedUser(auth)
      if (user) {
        return {
          ok: true,
          source: sawPasswordRecovery ? 'password_recovery' : 'pkce',
        }
      }

      const { error } = await auth.exchangeCodeForSession(code)
      user = await requireVerifiedUser(auth)
      if (user) {
        return {
          ok: true,
          source: sawPasswordRecovery ? 'password_recovery' : 'pkce',
        }
      }
      if (error) {
        if (isExpiredAuthMessage(error.message)) {
          return { ok: false, reason: 'expired' }
        }
        return { ok: false, reason: 'exchange_failed' }
      }
      return { ok: false, reason: 'expired' }
    }

    // Cookie-backed SSR clients may not consume the implicit hash automatically.
    // Establish the session explicitly when access/refresh tokens are present.
    const implicit = extractImplicitSessionFromHash(location.hash)
    if (implicit) {
      let user = await requireVerifiedUser(auth)
      if (!user) {
        const { error } = await auth.setSession({
          access_token: implicit.access_token,
          refresh_token: implicit.refresh_token,
        })
        user = await requireVerifiedUser(auth)
        if (!user) {
          if (error && isExpiredAuthMessage(error.message)) {
            return { ok: false, reason: 'expired' }
          }
          return { ok: false, reason: error ? 'exchange_failed' : 'expired' }
        }
      }
      return {
        ok: true,
        source:
          implicit.type === 'recovery' || sawPasswordRecovery
            ? 'password_recovery'
            : 'existing_session',
      }
    }

    // Allow detectSessionInUrl / PASSWORD_RECOVERY to settle, then verify with getUser().
    const deadline = Date.now() + settleMs
    while (Date.now() <= deadline) {
      const user = await requireVerifiedUser(auth)
      if (user && sawPasswordRecovery) {
        return { ok: true, source: 'password_recovery' }
      }
      // Invite/recovery hash marker without tokens is insufficient by itself.
      if (user && hadImplicitHash && sawPasswordRecovery) {
        return { ok: true, source: 'password_recovery' }
      }
      await sleep(100)
    }

    const user = await requireVerifiedUser(auth)
    if (user && sawPasswordRecovery) {
      return { ok: true, source: 'password_recovery' }
    }
    if (!hadAuthMarker && !sawPasswordRecovery) {
      return { ok: false, reason: 'missing' }
    }
    return { ok: false, reason: 'expired' }
  } finally {
    listener.subscription.unsubscribe()
  }
}

async function requireVerifiedUser(auth: AuthLike): Promise<User | null> {
  const { data, error } = await auth.getUser()
  if (error || !data.user) return null
  return data.user
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type SubmitPasswordRecoveryInput = {
  auth: AuthLike
  password: string
  confirmation: string
  /** Prevents double-submit when already in-flight. */
  isSubmitting: boolean
}

export type SubmitPasswordRecoveryResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; blocked?: boolean }

/**
 * Validate, update password, clear sensitive URL state, sign out, and return login redirect.
 */
export async function submitPasswordRecovery(
  input: SubmitPasswordRecoveryInput,
  deps?: {
    validate?: typeof validateNewPassword
    clearUrl?: () => void
  },
): Promise<SubmitPasswordRecoveryResult> {
  if (input.isSubmitting) {
    return { ok: false, message: '', blocked: true }
  }

  const validate = deps?.validate ?? validateNewPassword
  const policy = validate(input.password, input.confirmation)
  if (!policy.ok) {
    return { ok: false, message: policy.message }
  }

  const {
    data: { user },
    error: userError,
  } = await input.auth.getUser()
  if (userError || !user) {
    return { ok: false, message: SAFE_INVALID_LINK }
  }

  const { error } = await input.auth.updateUser({ password: input.password })
  if (error) {
    return { ok: false, message: mapPasswordUpdateError() }
  }

  deps?.clearUrl?.()
  await input.auth.signOut()
  return { ok: true, redirectTo: CRM_LOGIN_AFTER_PASSWORD_PATH }
}

/** Test helper: ensure safe messages never echo secrets. */
export function messageContainsSensitiveLeak(message: string, secrets: string[]): boolean {
  const lower = message.toLowerCase()
  return secrets.some((secret) => secret && lower.includes(secret.toLowerCase()))
}

export type { Session }
