/**
 * Public Supabase env helpers.
 * Never read or expose SUPABASE_SERVICE_ROLE_KEY here.
 */

function readProcessEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return String(process.env[name] ?? '').trim()
}

function readViteEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    // Vite client bundle only
    const env = import.meta.env
    return String(env?.[name] ?? '').trim()
  } catch {
    return ''
  }
}

export function getSupabaseUrl(): string {
  return readViteEnv('VITE_SUPABASE_URL') || readProcessEnv('VITE_SUPABASE_URL') || readProcessEnv('SUPABASE_URL')
}

export function getSupabaseAnonKey(): string {
  return (
    readViteEnv('VITE_SUPABASE_ANON_KEY') ||
    readProcessEnv('VITE_SUPABASE_ANON_KEY') ||
    readProcessEnv('SUPABASE_ANON_KEY')
  )
}

/** Server/edge only — prefers non-VITE names, falls back to VITE_* for local parity. */
export function getServerSupabaseUrl(): string {
  return readProcessEnv('SUPABASE_URL') || readProcessEnv('VITE_SUPABASE_URL')
}

export function getServerSupabaseAnonKey(): string {
  return readProcessEnv('SUPABASE_ANON_KEY') || readProcessEnv('VITE_SUPABASE_ANON_KEY')
}

export function assertPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
    )
  }

  return { url, anonKey }
}
