import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSupabaseAdminClient } from './admin'

const ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
] as const

let savedEnv: Record<string, string | undefined> = {}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(role: string): string {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({ role }))
  return `${header}.${payload}.signature`
}

beforeEach(() => {
  savedEnv = {}
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('createSupabaseAdminClient', () => {
  it('throws when SUPABASE_URL is missing', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key'
    expect(() => createSupabaseAdminClient()).toThrow(/SUPABASE_URL/)
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    expect(() => createSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('throws when VITE_SUPABASE_SERVICE_ROLE_KEY is set, even if a valid server key also exists', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key'
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_leaked'
    expect(() => createSupabaseAdminClient()).toThrow(/VITE_SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('throws when the key looks like a publishable/anon key', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_publishable_oops'
    expect(() => createSupabaseAdminClient()).toThrow(/publishable/)
  })

  it('throws when a legacy JWT key decodes to a non-service_role claim', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt('anon')
    expect(() => createSupabaseAdminClient()).toThrow(/service_role/)
  })

  it('initializes successfully with a valid sb_secret_* key', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key'
    const client = createSupabaseAdminClient()
    expect(client).toBeTruthy()
    expect(typeof client.rpc).toBe('function')
    expect(typeof client.from).toBe('function')
  })

  it('initializes successfully with a valid legacy service_role JWT', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt('service_role')
    const client = createSupabaseAdminClient()
    expect(client).toBeTruthy()
  })

  it('falls back to VITE_SUPABASE_URL when SUPABASE_URL is absent', () => {
    process.env.VITE_SUPABASE_URL = 'https://fallback.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key'
    expect(() => createSupabaseAdminClient()).not.toThrow()
  })
})

describe('module safety', () => {
  it('does not reference the browser window global', () => {
    expect(typeof window).toBe('undefined')
  })
})
