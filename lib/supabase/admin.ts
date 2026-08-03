/**
 * SERVER ONLY — never import from browser/Vite client code.
 *
 * Creates a Supabase client authenticated with the service-role secret, which
 * bypasses Row Level Security entirely. This client must only run in trusted
 * server contexts (Vercel API routes / server-only modules under `server/`).
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from './env'

export type AdminSupabaseClient = SupabaseClient

function assertNeverBrowser(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createSupabaseAdminClient() must never run in a browser context. It uses the service-role secret.',
    )
  }
}

function assertNoViteServiceRoleLeak(): void {
  const viteLeak =
    typeof process !== 'undefined' && process.env ? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY : undefined

  if (viteLeak) {
    throw new Error(
      'VITE_SUPABASE_SERVICE_ROLE_KEY must never be set. Use SUPABASE_SERVICE_ROLE_KEY (server-only, non-VITE env var) instead.',
    )
  }
}

/** Decodes a base64url JWT segment without depending on Node's Buffer typings. */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function decodeJwtRoleClaim(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null

  try {
    const payloadJson = decodeBase64Url(parts[1])
    const payload = JSON.parse(payloadJson) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/**
 * Best-effort shape check. Real authorization is enforced by Supabase itself —
 * this only guards against obvious misconfiguration (pasting the anon key).
 */
function assertLooksLikeServiceRoleKey(key: string): void {
  if (/^sb_publishable_/i.test(key)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY looks like a publishable/anon key (sb_publishable_*). Refusing to start the admin client.',
    )
  }

  if (/^sb_secret_/i.test(key)) {
    return
  }

  const role = decodeJwtRoleClaim(key)
  if (role && role !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY decodes to role "${role}", not "service_role". Refusing to start the admin client.`,
    )
  }
}

/**
 * Server-only Supabase admin client (service-role key, RLS bypassed).
 * Never persists/refreshes a browser session — every call is stateless.
 */
export function createSupabaseAdminClient(): AdminSupabaseClient {
  assertNeverBrowser()
  assertNoViteServiceRoleLeak()

  const url = getServerSupabaseUrl()
  const serviceRoleKey = getServerSupabaseServiceRoleKey()

  if (!url) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL fallback) for the admin Supabase client.')
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. The admin client must never fall back to the anon key.',
    )
  }

  assertLooksLikeServiceRoleKey(serviceRoleKey)

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
