import { describe, expect, it, vi } from 'vitest'
import {
  CRM_LOGIN_AFTER_PASSWORD_PATH,
  PASSWORD_UPDATED_BANNER,
  clearSensitiveAuthUrlState,
  establishPasswordRecoverySession,
  extractPkceCode,
  hasImplicitAuthHash,
  mapPasswordUpdateError,
  messageContainsSensitiveLeak,
  recoveryEstablishErrorMessage,
  submitPasswordRecovery,
} from './passwordRecovery'

function mockAuth(overrides: Record<string, unknown> = {}) {
  const listeners: Array<(event: string) => void> = []
  return {
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    setSession: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string) => void) => {
      listeners.push(cb)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    __emit(event: string) {
      for (const cb of listeners) cb(event)
    },
    ...overrides,
  }
}

describe('URL helpers', () => {
  it('extracts PKCE code from the query string', () => {
    expect(extractPkceCode('?code=abc123&other=1')).toBe('abc123')
    expect(extractPkceCode('')).toBeNull()
  })

  it('detects implicit invite/recovery hashes', () => {
    expect(hasImplicitAuthHash('#access_token=tok&type=recovery')).toBe(true)
    expect(hasImplicitAuthHash('#type=invite&refresh_token=r')).toBe(true)
    expect(hasImplicitAuthHash('#')).toBe(false)
    expect(hasImplicitAuthHash('')).toBe(false)
  })

  it('clears sensitive query and hash state via history replacement', () => {
    const replaceState = vi.fn()
    clearSensitiveAuthUrlState(
      {
        pathname: '/crm/auth/recovery',
        search: '?code=secret-code&utm=keep',
        hash: '#access_token=secret-token&type=recovery',
      },
      replaceState,
    )
    expect(replaceState).toHaveBeenCalledWith('/crm/auth/recovery?utm=keep')
    const url = String(replaceState.mock.calls[0][0])
    expect(url).not.toContain('secret-code')
    expect(url).not.toContain('secret-token')
    expect(url).not.toContain('access_token')
  })
})

describe('establishPasswordRecoverySession', () => {
  it('shows invalid/missing when there is no session and no auth markers', async () => {
    const auth = mockAuth()
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })

  it('enables the form after a successful PKCE exchange with a verified user', async () => {
    let calls = 0
    const auth = mockAuth({
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
      getUser: vi.fn(async () => {
        calls += 1
        // First probe (pre-exchange) empty; post-exchange verified.
        if (calls === 1) return { data: { user: null }, error: null }
        return { data: { user: { id: 'u1' } }, error: null }
      }),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '?code=pkce-code', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: true, source: 'pkce' })
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code')
  })

  it('maps exchange failure safely', async () => {
    const auth = mockAuth({
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: { message: 'invalid request' },
      })),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '?code=bad', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: false, reason: 'exchange_failed' })
    expect(recoveryEstablishErrorMessage('exchange_failed')).not.toMatch(/bad|token|password/i)
  })

  it('treats an already-consumed PKCE code as success when a verified user exists', async () => {
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: { message: 'invalid request: both auth code and code verifier should be non-empty' },
      })),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '?code=already-used', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: true, source: 'pkce' })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('maps expired/consumed exchange errors', async () => {
    const auth = mockAuth({
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: { message: 'flow_state_expired' },
      })),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '?code=old', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('enables the form on PASSWORD_RECOVERY with a verified user', async () => {
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    })
    const promise = establishPasswordRecoverySession(
      auth as never,
      { search: '', hash: '' },
      { settleMs: 400 },
    )
    auth.__emit('PASSWORD_RECOVERY')
    const result = await promise
    expect(result).toEqual({ ok: true, source: 'password_recovery' })
  })

  it('enables the form via token_hash email OTP query', async () => {
    let calls = 0
    const auth = mockAuth({
      verifyOtp: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      getUser: vi.fn(async () => {
        calls += 1
        if (calls === 1) return { data: { user: null }, error: null }
        return { data: { user: { id: 'u1' } }, error: null }
      }),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '?token_hash=th_test&type=invite', hash: '' },
      { settleMs: 50 },
    )
    expect(result.ok).toBe(true)
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'th_test' })
  })

  it('enables the form for invite/recovery hash sessions via setSession', async () => {
    let calls = 0
    const auth = mockAuth({
      setSession: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      getUser: vi.fn(async () => {
        calls += 1
        if (calls === 1) return { data: { user: null }, error: null }
        return { data: { user: { id: 'u1' } }, error: null }
      }),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '', hash: '#access_token=abc&refresh_token=def&type=invite' },
      { settleMs: 50 },
    )
    expect(result.ok).toBe(true)
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'abc',
      refresh_token: 'def',
    })
  })

  it('rejects a normal existing session without recovery/invite markers', async () => {
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    })
    const result = await establishPasswordRecoverySession(
      auth as never,
      { search: '', hash: '' },
      { settleMs: 50 },
    )
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })
})

describe('submitPasswordRecovery', () => {
  it('prevents double-submit', async () => {
    const auth = mockAuth()
    const result = await submitPasswordRecovery({
      auth: auth as never,
      password: 'CorrectHorse!9x',
      confirmation: 'CorrectHorse!9x',
      isSubmitting: true,
    })
    expect(result).toEqual({ ok: false, message: '', blocked: true })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects weak passwords before calling updateUser', async () => {
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    })
    const result = await submitPasswordRecovery({
      auth: auth as never,
      password: 'short',
      confirmation: 'short',
      isSubmitting: false,
    })
    expect(result.ok).toBe(false)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('maps updateUser failure to a safe error without leaking secrets', async () => {
    const secret = 'CorrectHorse!9x'
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      updateUser: vi.fn(async () => ({
        data: {},
        error: { message: `cannot set password ${secret}` },
      })),
    })
    const result = await submitPasswordRecovery({
      auth: auth as never,
      password: secret,
      confirmation: secret,
      isSubmitting: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe(mapPasswordUpdateError())
      expect(messageContainsSensitiveLeak(result.message, [secret, 'u1'])).toBe(false)
    }
  })

  it('signs out and redirects to login with passwordUpdated=1 on success', async () => {
    const clearUrl = vi.fn()
    const auth = mockAuth({
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      updateUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    })
    const result = await submitPasswordRecovery(
      {
        auth: auth as never,
        password: 'CorrectHorse!9x',
        confirmation: 'CorrectHorse!9x',
        isSubmitting: false,
      },
      { clearUrl },
    )
    expect(result).toEqual({ ok: true, redirectTo: CRM_LOGIN_AFTER_PASSWORD_PATH })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(clearUrl).toHaveBeenCalledTimes(1)
    expect(CRM_LOGIN_AFTER_PASSWORD_PATH).toBe('/crm/login?passwordUpdated=1')
  })
})

describe('login banner contract', () => {
  it('uses the approved success copy', () => {
    expect(PASSWORD_UPDATED_BANNER).toBe('Password created. Sign in to continue.')
  })
})
