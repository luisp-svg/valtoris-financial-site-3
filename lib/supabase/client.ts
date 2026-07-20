import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertPublicSupabaseEnv } from './env'

let browserClient: SupabaseClient | null = null

/**
 * Cookie-backed browser client (recommended @supabase/ssr pattern).
 * Safe for CRM UI only — uses the anon/publishable key + RLS.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient

  const { url, anonKey } = assertPublicSupabaseEnv()
  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
