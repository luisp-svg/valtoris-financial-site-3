import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from './env'

/**
 * Per-request server client for Vercel API routes.
 * Validates sessions with Supabase Auth (getUser) — never trust getSession alone.
 * Never uses the service-role key.
 */
export function createSupabaseServerClient(
  req: VercelRequest,
  res: VercelResponse,
): SupabaseClient {
  const url = getServerSupabaseUrl()
  const anonKey = getServerSupabaseAnonKey()

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_* fallbacks) on the server.')
  }

  const cookieHeader = req.headers.cookie ?? ''

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader)
      },
      setAll(cookiesToSet, cacheHeaders) {
        const serialized = cookiesToSet.map(({ name, value, options }) =>
          serializeCookieHeader(name, value, options),
        )
        const existing = res.getHeader('Set-Cookie')
        const merged = [
          ...(Array.isArray(existing)
            ? existing.map(String)
            : existing
              ? [String(existing)]
              : []),
          ...serialized,
        ]
        res.setHeader('Set-Cookie', merged)
        if (cacheHeaders) {
          for (const [key, value] of Object.entries(cacheHeaders)) {
            res.setHeader(key, value)
          }
        }
      },
    },
  })
}
