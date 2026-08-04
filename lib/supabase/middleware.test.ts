import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const next = vi.fn(() => new Response('ok', { status: 200 }))

vi.mock('@vercel/edge', () => ({
  next: () => next(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
  parseCookieHeader: vi.fn(() => []),
  serializeCookieHeader: vi.fn(() => 'cookie=1'),
}))

vi.mock('./env', () => ({
  getServerSupabaseUrl: () => 'https://example.supabase.co',
  getServerSupabaseAnonKey: () => 'anon-key',
}))

describe('updateCrmSession public auth paths', () => {
  beforeEach(() => {
    getUser.mockReset()
    next.mockClear()
  })

  it('permits /crm/login without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { updateCrmSession } = await import('./middleware')
    const response = await updateCrmSession(new Request('https://www.example.com/crm/login'))
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('permits /crm/auth/recovery without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { updateCrmSession } = await import('./middleware')
    const response = await updateCrmSession(
      new Request('https://www.example.com/crm/auth/recovery?code=abc'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('still protects /crm when unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { updateCrmSession } = await import('./middleware')
    const response = await updateCrmSession(new Request('https://www.example.com/crm'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/crm/login')
  })

  it('still protects other CRM routes when unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { updateCrmSession } = await import('./middleware')
    for (const path of ['/crm/households', '/crm/tasks', '/crm/settings', '/crm/intake']) {
      const response = await updateCrmSession(new Request(`https://www.example.com${path}`))
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toContain('/crm/login')
    }
  })

  it('does not redirect authenticated recovery traffic away from the recovery route', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const { updateCrmSession } = await import('./middleware')
    const response = await updateCrmSession(
      new Request('https://www.example.com/crm/auth/recovery'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('isPublicCrmAuthPath', () => {
  it('allows only login and recovery', async () => {
    const { isPublicCrmAuthPath } = await import('./crmPublicAuthPaths')
    expect(isPublicCrmAuthPath('/crm/login')).toBe(true)
    expect(isPublicCrmAuthPath('/crm/auth/recovery')).toBe(true)
    expect(isPublicCrmAuthPath('/crm')).toBe(false)
    expect(isPublicCrmAuthPath('/crm/auth')).toBe(false)
    expect(isPublicCrmAuthPath('/crm/auth/recovery/extra')).toBe(false)
  })
})
